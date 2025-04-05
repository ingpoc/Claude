#!/usr/bin/env python3
import requests
import json
import time
import uuid
import threading
import sseclient
import os
import re
from pathlib import Path

class MCPTester:
    """Tester for the Model Context Protocol (MCP) server"""
    
    def __init__(self, base_url="http://localhost:3000/api/mcp"):
        self.base_url = base_url
        self.session_id = f"codebase-kg-{uuid.uuid4()}"
        self.sse_thread = None
        self.sse_client = None
        self.connected = False
        self.responses = {}
        self.project_id = None
        # Track created entities
        self.entities = {}
        # Store relationships for visualization
        self.relationships = []
        
    def start_sse_connection(self):
        """Start an SSE connection in a background thread"""
        print(f"Starting SSE connection with session ID: {self.session_id}")
        self.sse_thread = threading.Thread(target=self._sse_listener, daemon=True)
        self.sse_thread.start()
        
        # Wait for connection to establish
        timeout = 10
        start_time = time.time()
        while not self.connected and time.time() - start_time < timeout:
            time.sleep(0.1)
            
        if self.connected:
            print("✅ SSE connection established successfully")
        else:
            print("❌ Failed to establish SSE connection")
            
        return self.connected
    
    def _sse_listener(self):
        """Listen for SSE events"""
        try:
            # Enhanced headers for SSE connection
            headers = {
                "Accept": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            }
            
            print(f"Requesting SSE connection from: {self.base_url}?sessionId={self.session_id}")
            print(f"With headers: {headers}")
            
            response = requests.get(
                f"{self.base_url}?sessionId={self.session_id}",
                stream=True,
                headers=headers
            )
            
            print(f"SSE response status: {response.status_code}")
            print("Response headers:")
            for key, value in response.headers.items():
                print(f"  {key}: {value}")
            
            if response.status_code == 200:
                # Check content type
                content_type = response.headers.get('Content-Type', '')
                print(f"Content type: {content_type}")
                
                # Try to read first chunk
                first_chunk = ""
                for chunk in response.iter_content(chunk_size=1024):
                    if chunk:
                        first_chunk = chunk.decode('utf-8')
                        break
                print(f"First chunk received: {first_chunk[:100]}")
                
                # Only mark as connected if we got appropriate content
                if first_chunk:
                    self.connected = True
                    # Create a new response to continue streaming after reading chunk
                    response = requests.get(
                        f"{self.base_url}?sessionId={self.session_id}",
                        stream=True,
                        headers=headers
                    )
                    
                    client = sseclient.SSEClient(response)
                    print("SSE client established, waiting for events...")
                    
                    for event in client.events():
                        print(f"Received event: {event.event}")
                        
                        try:
                            data = json.loads(event.data)
                            print(f"Event data: {json.dumps(data)[:100]}...")
                            
                            # Store response if it contains an ID
                            if event.event == "response" and "id" in data:
                                self.responses[data["id"]] = data
                        except:
                            print(f"Raw event data: {event.data[:100]}...")
                else:
                    print("❌ No data received from SSE stream")
            else:
                print(f"❌ SSE connection failed with status {response.status_code}")
                print(f"Response: {response.text[:500]}")
                
        except Exception as e:
            print(f"Error in SSE listener: {str(e)}")
            import traceback
            traceback.print_exc()
            
    def call_tool(self, tool_name, args=None):
        """Call a tool on the MCP server and wait for the response"""
        if not self.connected:
            print("Cannot call tool: Not connected to SSE")
            return None
            
        request_id = str(uuid.uuid4())
        
        payload = {
            "type": "request",
            "id": request_id,
            "tool": tool_name,
            "args": args or {}
        }
        
        print(f"Calling tool '{tool_name}' with args: {json.dumps(args, indent=2)}")
        
        try:
            response = requests.post(
                f"{self.base_url}?sessionId={self.session_id}",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                print(f"❌ Request failed: {response.status_code}")
                print(response.text)
                return None
                
            # Wait for the response
            timeout = 30  # longer timeout for complex operations
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
                
                # Extract content text if it exists
                content_text = None
                if response_data.get("content") and len(response_data["content"]) > 0:
                    content_text = response_data["content"][0].get("text")
                    if content_text:
                        try:
                            # Try to parse JSON content
                            return json.loads(content_text)
                        except:
                            # If not JSON, return the raw text
                            return content_text
                
                return response_data
            else:
                print(f"❌ No response received for tool call: {tool_name}")
                return None
                
        except Exception as e:
            print(f"Error calling tool: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
            
    def create_project(self):
        """Create a project for the codebase knowledge graph"""
        print("\n==== Creating a codebase knowledge graph project ====")
        
        result = self.call_tool("create_project", {
            "name": "MCP-Codebase-KG",
            "description": "Knowledge graph of the MCP codebase structure and relationships"
        })
        
        if result and "id" in result:
            self.project_id = result["id"]
            print(f"✅ Created project: {result['name']} (ID: {self.project_id})")
            return True
        else:
            print("❌ Failed to create project")
            return False
            
    def create_entity(self, name, type, description, observations=None):
        """Create an entity in the knowledge graph"""
        if not self.project_id:
            print("❌ Cannot create entity: No project selected")
            return None
            
        args = {
            "name": name,
            "type": type,
            "description": description
        }
        
        if observations:
            args["observations"] = observations
            
        result = self.call_tool("create_entity", args)
        
        if result and "id" in result:
            entity_id = result["id"]
            # Store entity for reference
            self.entities[name] = entity_id
            print(f"✅ Created entity: {name} (ID: {entity_id})")
            return entity_id
        else:
            print(f"❌ Failed to create entity: {name}")
            return None
            
    def create_relationship(self, from_entity, to_entity, rel_type):
        """Create a relationship between entities"""
        if not self.project_id:
            print("❌ Cannot create relationship: No project selected")
            return None
            
        # Get entity IDs
        from_id = self.entities.get(from_entity)
        to_id = self.entities.get(to_entity)
        
        if not from_id or not to_id:
            print(f"❌ Cannot create relationship: Missing entity ID ({from_entity} → {to_entity})")
            return None
            
        result = self.call_tool("create_relationship", {
            "from": from_id,
            "to": to_id,
            "type": rel_type
        })
        
        if result and "id" in result:
            rel_id = result["id"]
            # Store relationship for visualization
            self.relationships.append({
                "from": from_entity,
                "to": to_entity,
                "type": rel_type,
                "id": rel_id
            })
            print(f"✅ Created relationship: {from_entity} --[{rel_type}]--> {to_entity}")
            return rel_id
        else:
            print(f"❌ Failed to create relationship: {from_entity} --[{rel_type}]--> {to_entity}")
            return None
            
    def scan_directory(self, path="."):
        """Scan a directory and map code files to entities"""
        if not self.project_id:
            print("❌ Cannot scan directory: No project selected")
            return False
            
        print(f"\n==== Scanning directory: {path} ====")
        
        # Create an entity for the MCP project itself
        project_entity = self.create_entity(
            name="MCP Codebase",
            type="Project",
            description="The Model Context Protocol (MCP) implementation",
            observations=["Main project containing all codebase elements"]
        )
        
        # Map of file extensions to language/entity types
        extension_map = {
            ".py": "Python",
            ".js": "JavaScript",
            ".ts": "TypeScript",
            ".tsx": "React",
            ".json": "JSON", 
            ".html": "HTML",
            ".css": "CSS",
            ".md": "Markdown"
        }
        
        # Track directories and modules
        directories = {}
        modules = {}
        
        # Create a entity for root directory
        root_dir_entity = self.create_entity(
            name="root",
            type="Directory",
            description="Root directory of the codebase",
            observations=["Contains the main structure of the MCP codebase"]
        )
        
        # Create relationship from project to root
        self.create_relationship(
            from_entity="MCP Codebase",
            to_entity="root",
            rel_type="CONTAINS"
        )
        
        for root, dirs, files in os.walk(path):
            # Skip hidden directories and node_modules
            dirs[:] = [d for d in dirs if not d.startswith('.') and d != 'node_modules' and d != '.git']
            
            relative_root = os.path.relpath(root, path)
            if relative_root == '.':
                dir_entity_name = "root"
            else:
                # Create entity for this directory
                dir_name = os.path.basename(relative_root)
                dir_entity_name = relative_root
                
                # Check if parent directory exists
                parent_dir = os.path.dirname(relative_root)
                if parent_dir == '':
                    parent_dir = "root"
                
                # Create directory entity if it doesn't exist
                if dir_entity_name not in directories:
                    dir_entity = self.create_entity(
                        name=dir_entity_name,
                        type="Directory",
                        description=f"Directory containing {dir_name} files",
                        observations=[f"Path: {relative_root}"]
                    )
                    directories[dir_entity_name] = dir_entity
                    
                    # Create relationship with parent directory
                    self.create_relationship(
                        from_entity=parent_dir,
                        to_entity=dir_entity_name,
                        rel_type="CONTAINS"
                    )
            
            # Process files
            for file in files:
                if file.startswith('.'):
                    continue
                    
                file_path = os.path.join(relative_root, file)
                file_ext = os.path.splitext(file)[1]
                file_type = extension_map.get(file_ext, "Other")
                
                # Special case for MCP API route
                if file_path == "app/api/mcp/route.ts":
                    file_entity = self.create_entity(
                        name=file_path,
                        type="API",
                        description="Main MCP API implementation route",
                        observations=[
                            "Implements the MCP server and API endpoints",
                            "Handles SSE connections and tool invocations"
                        ]
                    )
                # Special case for knowledge graph implementation
                elif file_path == "lib/knowledgeGraph.ts":
                    file_entity = self.create_entity(
                        name=file_path,
                        type="Module",
                        description="Knowledge Graph implementation module",
                        observations=[
                            "Implements entity and relationship management",
                            "Provides database integration for the knowledge graph"
                        ]
                    )
                # Create entities for Python test files
                elif file_ext == '.py' and (file.startswith('test_') or file.startswith('mcp_')):
                    file_entity = self.create_entity(
                        name=file_path,
                        type="TestModule",
                        description=f"Test module for MCP",
                        observations=[f"Tests functionality of the MCP API"]
                    )
                else:
                    # Create generic file entity
                    file_entity = self.create_entity(
                        name=file_path,
                        type=f"{file_type}File",
                        description=f"{file_type} file: {file}",
                        observations=[f"Path: {file_path}"]
                    )
                
                # Create relationship with containing directory
                parent_dir = relative_root
                if parent_dir == '.':
                    parent_dir = "root"
                
                self.create_relationship(
                    from_entity=parent_dir,
                    to_entity=file_path,
                    rel_type="CONTAINS"
                )
                
                # Create relationship with project
                self.create_relationship(
                    from_entity="MCP Codebase",
                    to_entity=file_path,
                    rel_type="INCLUDES"
                )
        
        print(f"\n==== Knowledge Graph for {path} built successfully ====")
        print(f"Created {len(self.entities)} entities and {len(self.relationships)} relationships")
        return True
        
    def analyze_code_relationships(self):
        """Analyze imports and dependencies between files"""
        print("\n==== Analyzing code relationships ====")
        
        # Find Python files to analyze
        python_files = [name for name in self.entities.keys() if name.endswith('.py')]
        
        for file_path in python_files:
            try:
                with open(file_path, 'r') as f:
                    content = f.read()
                    
                # Simple import pattern matching
                import_pattern = r'import\s+(\w+)'
                from_import_pattern = r'from\s+([\w\.]+)\s+import'
                
                imports = re.findall(import_pattern, content)
                from_imports = re.findall(from_import_pattern, content)
                
                all_imports = set(imports + from_imports)
                
                # Look for imported modules in our entity list
                for imp in all_imports:
                    # For simple module names
                    for target_file in python_files:
                        target_module = os.path.splitext(os.path.basename(target_file))[0]
                        
                        if target_module == imp:
                            # Create IMPORTS relationship
                            self.create_relationship(
                                from_entity=file_path,
                                to_entity=target_file,
                                rel_type="IMPORTS"
                            )
            except Exception as e:
                print(f"Error analyzing {file_path}: {str(e)}")
                
        # Analyze TypeScript/JavaScript files
        ts_files = [name for name in self.entities.keys() 
                   if name.endswith('.ts') or name.endswith('.tsx') or name.endswith('.js')]
        
        for file_path in ts_files:
            try:
                with open(file_path, 'r') as f:
                    content = f.read()
                    
                # Simple import pattern matching
                import_pattern = r'import.*from\s+[\'"]([^\'"]+)[\'"]'
                require_pattern = r'require\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)'
                
                imports = re.findall(import_pattern, content)
                requires = re.findall(require_pattern, content)
                
                all_imports = set(imports + requires)
                
                for imp in all_imports:
                    # Skip external packages
                    if imp.startswith('@') or not (imp.startswith('./') or imp.startswith('../') or imp.startswith('/') or imp == '.'):
                        continue
                        
                    # Resolve relative imports
                    target_path = os.path.normpath(os.path.join(os.path.dirname(file_path), imp))
                    
                    # Add extensions if missing
                    if not os.path.exists(target_path):
                        for ext in ['.ts', '.tsx', '.js']:
                            if os.path.exists(target_path + ext):
                                target_path += ext
                                break
                                
                    # Check if target file exists in our entities
                    if target_path in self.entities:
                        self.create_relationship(
                            from_entity=file_path,
                            to_entity=target_path,
                            rel_type="IMPORTS"
                        )
            except Exception as e:
                print(f"Error analyzing {file_path}: {str(e)}")
                
        print(f"Added {len(self.relationships)} dependency relationships")
        return True
        
    def visualize_knowledge_graph(self):
        """Generate a simple visualization of the knowledge graph"""
        print("\n==== Knowledge Graph Summary ====")
        
        print(f"Total entities: {len(self.entities)}")
        print(f"Total relationships: {len(self.relationships)}")
        
        # Count by type
        entity_types = {}
        for entity_name, entity_id in self.entities.items():
            entity_type = "Unknown"
            if "/" in entity_name:
                ext = os.path.splitext(entity_name)[1]
                if ext:
                    entity_type = ext[1:]  # Remove the dot
                    
            if entity_type not in entity_types:
                entity_types[entity_type] = 0
            entity_types[entity_type] += 1
            
        print("\nEntity types:")
        for entity_type, count in entity_types.items():
            print(f"  {entity_type}: {count}")
            
        # Count relationships by type
        relationship_types = {}
        for rel in self.relationships:
            rel_type = rel["type"]
            if rel_type not in relationship_types:
                relationship_types[rel_type] = 0
            relationship_types[rel_type] += 1
            
        print("\nRelationship types:")
        for rel_type, count in relationship_types.items():
            print(f"  {rel_type}: {count}")
            
    def run_test(self):
        """Run a full test of the MCP API by building a knowledge graph"""
        # Step 1: Establish SSE connection
        if not self.start_sse_connection():
            return False
            
        # Step 2: Create a project
        if not self.create_project():
            return False
            
        # Step 3: Scan directory and create entities
        if not self.scan_directory():
            return False
            
        # Step 4: Analyze code relationships
        if not self.analyze_code_relationships():
            return False
            
        # Step 5: Visualize knowledge graph
        self.visualize_knowledge_graph()
        
        return True

if __name__ == "__main__":
    tester = MCPTester()
    success = tester.run_test()
    
    print("\n==== Test Summary ====")
    if success:
        print("✅ MCP API test completed successfully!")
        print("Knowledge graph of codebase built successfully.")
    else:
        print("❌ MCP API test failed!")
        
    # Keep the script running to maintain the SSE connection
    try:
        print("\nPress Ctrl+C to exit...")
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nTest terminated by user") 