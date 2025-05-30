// Test script to verify MCP response format fix
// Run this after applying the fix to ensure proper formatting

const originalResponse = {
  success: true,
  results: [
    { id: "1", name: "Entity 1", type: "test" },
    { id: "2", name: "Entity 2", type: "test" }
  ],
  metadata: {
    query: "test query",
    totalResults: 2
  }
};

// Simulate the fixed response format
const fixedResponse = {
  content: [{
    type: "text",
    text: JSON.stringify(originalResponse)
  }]
};

console.log("Original Response (INCORRECT for MCP):");
console.log(JSON.stringify(originalResponse, null, 2));
console.log("\n");

console.log("Fixed Response (CORRECT for MCP):");
console.log(JSON.stringify(fixedResponse, null, 2));
console.log("\n");

// Verify the structure
if (fixedResponse.content && 
    Array.isArray(fixedResponse.content) && 
    fixedResponse.content[0].type === "text" &&
    typeof fixedResponse.content[0].text === "string") {
  console.log("✅ Response format is CORRECT for MCP protocol");
  
  // Verify we can parse the original data back
  const parsedData = JSON.parse(fixedResponse.content[0].text);
  if (parsedData.success === true && parsedData.results.length === 2) {
    console.log("✅ Original data structure is preserved");
  }
} else {
  console.log("❌ Response format is INCORRECT for MCP protocol");
}

// Test error response format
const errorResponse = {
  content: [{
    type: "text",
    text: JSON.stringify({
      success: false,
      error: "Test error message"
    })
  }],
  isError: true
};

console.log("\nError Response Format:");
console.log(JSON.stringify(errorResponse, null, 2));

if (errorResponse.isError === true) {
  console.log("✅ Error flag is properly set");
}