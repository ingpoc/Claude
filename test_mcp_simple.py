#!/usr/bin/env python3
import requests
import json
import time
import uuid
import threading
import sseclient

def test_mcp_connection():
    print("Testing MCP connection...")
    
    # Make a basic GET request to check if server is responding
    try:
        response = requests.get("http://localhost:3000")
        print(f"Server response: {response.status_code}")
        if response.status_code != 200:
            print("❌ Error: Server not responding correctly")
            return False
        print("✅ Server is running")
        return True
    except Exception as e:
        print(f"❌ Error connecting to server: {str(e)}")
        return False

class MCPClient:
    """Simple client for interacting with the MCP API"""
    
    def __init__(self, base_url="http://localhost:3000/api/mcp"):
        self.base_url = base_url
        self.session_id = f"simple-test-session-{uuid.uuid4().hex[:8]}"
        self.connected = False
        self.sse_thread = None
        self.responses = {}
        
    def start_sse_connection(self):
        """Start SSE connection in a background thread"""
        print(f"Starting SSE connection with session ID: {self.session_id}")
        
        self.sse_thread = threading.Thread(target=self._sse_listener, daemon=True)
        self.sse_thread.start()
        
        # Wait for connection to establish
        timeout = 10
        start_time = time.time()
        while not self.connected and time.time() - start_time < timeout:
            time.sleep(0.1)
            
        if self.connected:
            print("✅ SSE connection established")
        else:
            print("❌ Failed to establish SSE connection")
            
        return self.connected
        
    def _sse_listener(self):
        """Listen for SSE events in a background thread"""
        try:
            # Request headers for SSE connection
            headers = {
                "Accept": "text/event-stream",
                "Cache-Control": "no-cache"
            }
            
            print(f"Connecting to: {self.base_url}?sessionId={self.session_id}")
            print(f"Headers: {headers}")
            
            # Establish SSE connection
            response = requests.get(
                f"{self.base_url}?sessionId={self.session_id}",
                stream=True,
                headers=headers
            )
            
            print(f"SSE connection response status: {response.status_code}")
            if response.status_code == 200:
                content_type = response.headers.get('Content-Type', '')
                print(f"Response content type: {content_type}")
                
                # Mark as connected if we get a successful response
                self.connected = True
                
                # Process SSE events
                client = sseclient.SSEClient(response)
                for event in client.events():
                    # Process received events
                    print(f"Event received: {event.event}")
                    try:
                        # Parse event data as JSON if possible
                        data = json.loads(event.data)
                        
                        # If this is a response to a request, store it
                        if event.event == "response" and "id" in data:
                            self.responses[data["id"]] = data
                            print(f"Response received for request ID: {data['id']}")
                    except json.JSONDecodeError:
                        print(f"Non-JSON event data: {event.data}")
            else:
                print(f"❌ SSE connection failed with status: {response.status_code}")
                print(f"Response body: {response.text[:200]}..." if len(response.text) > 200 else response.text)
                
        except Exception as e:
            print(f"❌ SSE listener error: {str(e)}")
            import traceback
            traceback.print_exc()
            
    def call_tool(self, tool_name, args=None):
        """Call a tool on the MCP server and wait for the response"""
        if not self.connected:
            print("❌ Cannot call tool: Not connected")
            return None
            
        # Generate a unique request ID
        request_id = str(uuid.uuid4())
        
        # Prepare request payload
        payload = {
            "type": "request",
            "id": request_id,
            "tool": tool_name,
            "args": args or {}
        }
        
        print(f"Calling tool: {tool_name}")
        print(f"Args: {json.dumps(args or {})}")
        
        try:
            # Send the request
            response = requests.post(
                f"{self.base_url}?sessionId={self.session_id}",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                print(f"❌ Tool request failed: {response.status_code}")
                print(f"Response: {response.text}")
                return None
                
            print(f"✅ Tool request sent successfully (ID: {request_id})")
            
            # Wait for the response in the SSE stream
            timeout = 30
            start_time = time.time()
            
            while request_id not in self.responses and time.time() - start_time < timeout:
                time.sleep(0.1)
                
            if request_id in self.responses:
                response_data = self.responses[request_id]
                
                # Check for errors
                if response_data.get("isError", False):
                    error_text = "Unknown error"
                    if response_data.get("content") and len(response_data["content"]) > 0:
                        error_text = response_data["content"][0].get("text", error_text)
                    print(f"❌ Tool call error: {error_text}")
                    return None
                    
                # Try to parse content if it exists
                if response_data.get("content") and len(response_data["content"]) > 0:
                    content_text = response_data["content"][0].get("text")
                    if content_text:
                        try:
                            return json.loads(content_text)
                        except json.JSONDecodeError:
                            return content_text
                
                return response_data
            else:
                print(f"❌ No response received for tool call within timeout")
                return None
                
        except Exception as e:
            print(f"❌ Error calling tool: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
            
def build_simple_knowledge_graph():
    """Build a simplified knowledge graph of the MCP codebase"""
    
    # First test if the server is running
    if not test_mcp_connection():
        return False
        
    # Create MCP client
    client = MCPClient()
    
    # Start SSE connection
    if not client.start_sse_connection():
        return False
        
    print("\n==== Building Knowledge Graph of MCP Codebase ====")
    
    # Step 1: Create a project
    print("\n1. Creating a project for the knowledge graph...")
    project_result = client.call_tool("create_project", {
        "name": "MCP-Codebase-Simple-KG",
        "description": "Simple knowledge graph of the MCP codebase"
    })
    
    if not project_result:
        print("❌ Failed to create project")
        return False
        
    print(f"✅ Created project: {project_result.get('name', 'Unknown')} (ID: {project_result.get('id', 'Unknown')})")
    
    # Step 2: Create entities for key components
    print("\n2. Creating entities for key components...")
    entities = {}
    
    # Create entity for the main MCP API
    api_result = client.call_tool("create_entity", {
        "name": "MCP API",
        "type": "API",
        "description": "Main API implementation for the Model Context Protocol"
    })
    
    if api_result:
        entities["MCP API"] = api_result["id"]
        print(f"✅ Created entity: MCP API (ID: {api_result['id']})")
    else:
        print("❌ Failed to create MCP API entity")
        
    # Create entity for Knowledge Graph implementation
    kg_result = client.call_tool("create_entity", {
        "name": "Knowledge Graph",
        "type": "Module",
        "description": "Implementation of the knowledge graph functionality"
    })
    
    if kg_result:
        entities["Knowledge Graph"] = kg_result["id"]
        print(f"✅ Created entity: Knowledge Graph (ID: {kg_result['id']})")
    else:
        print("❌ Failed to create Knowledge Graph entity")
        
    # Create entity for client library
    client_result = client.call_tool("create_entity", {
        "name": "MCP Client",
        "type": "Library",
        "description": "Client library for interacting with the MCP API"
    })
    
    if client_result:
        entities["MCP Client"] = client_result["id"]
        print(f"✅ Created entity: MCP Client (ID: {client_result['id']})")
    else:
        print("❌ Failed to create MCP Client entity")
        
    # Step 3: Create relationships between components
    print("\n3. Creating relationships between components...")
    
    if "MCP API" in entities and "Knowledge Graph" in entities:
        kg_rel_result = client.call_tool("create_relationship", {
            "from": entities["MCP API"],
            "to": entities["Knowledge Graph"],
            "type": "USES"
        })
        
        if kg_rel_result:
            print(f"✅ Created relationship: MCP API --[USES]--> Knowledge Graph")
        else:
            print("❌ Failed to create MCP API → Knowledge Graph relationship")
            
    if "MCP Client" in entities and "MCP API" in entities:
        client_rel_result = client.call_tool("create_relationship", {
            "from": entities["MCP Client"],
            "to": entities["MCP API"],
            "type": "INTERACTS_WITH"
        })
        
        if client_rel_result:
            print(f"✅ Created relationship: MCP Client --[INTERACTS_WITH]--> MCP API")
        else:
            print("❌ Failed to create MCP Client → MCP API relationship")
            
    # Step 4: Add observations about the code
    print("\n4. Adding observations to entities...")
    
    if "MCP API" in entities:
        api_obs_result = client.call_tool("add_observation", {
            "entity_id": entities["MCP API"],
            "text": "Implements a Server-Sent Events (SSE) transport layer for real-time communication"
        })
        
        if api_obs_result:
            print(f"✅ Added observation to MCP API entity")
        else:
            print("❌ Failed to add observation to MCP API entity")
            
    if "Knowledge Graph" in entities:
        kg_obs_result = client.call_tool("add_observation", {
            "entity_id": entities["Knowledge Graph"],
            "text": "Uses KuzuDB for graph database storage and querying"
        })
        
        if kg_obs_result:
            print(f"✅ Added observation to Knowledge Graph entity")
        else:
            print("❌ Failed to add observation to Knowledge Graph entity")
            
    # Step 5: Retrieve entities to verify graph creation
    print("\n5. Retrieving entities to verify graph creation...")
    
    entities_result = client.call_tool("list_entities", {})
    
    if entities_result:
        print(f"✅ Retrieved {len(entities_result)} entities from the knowledge graph")
        for entity in entities_result:
            print(f"  - {entity.get('name')} ({entity.get('type')}): {entity.get('description')}")
    else:
        print("❌ Failed to retrieve entities")
        
    print("\n==== Knowledge Graph Building Complete ====")
    return True

if __name__ == "__main__":
    try:
        success = build_simple_knowledge_graph()
        
        if success:
            print("\n✅ Successfully built knowledge graph of MCP codebase")
        else:
            print("\n❌ Failed to build knowledge graph of MCP codebase")
            
        # Keep script running to maintain SSE connection
        print("\nPress Ctrl+C to exit...")
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nTest terminated by user") 