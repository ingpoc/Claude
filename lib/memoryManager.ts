// This file manages AI memory persistence and retrieval

export interface UserMemory {
  basicIdentity?: {
    name?: string;
    age?: number;
    gender?: string;
    location?: string;
    jobTitle?: string;
    educationLevel?: string;
    [key: string]: any;
  };
  
  behaviors?: {
    interests?: string[];
    habits?: string[];
    [key: string]: any;
  };
  
  preferences?: {
    communicationStyle?: string;
    preferredLanguage?: string;
    [key: string]: any;
  };
  
  goals?: {
    targets?: string[];
    aspirations?: string[];
    [key: string]: any;
  };
  
  relationships?: {
    personal?: Record<string, any>;
    professional?: Record<string, any>;
    [key: string]: any;
  };
}

// In-memory store for development purposes
// In production, this would be replaced with a database
const memoryStore: Record<string, UserMemory> = {
  default_user: {
    basicIdentity: {
      name: 'User',
    },
    behaviors: {
      interests: ['AI development', 'Knowledge graphs'],
    }
  }
};

// Get user memory
export async function getUserMemory(userId: string = 'default_user'): Promise<UserMemory> {
  // In a real application, this would fetch from a database or API
  return memoryStore[userId] || {};
}

// Update user memory
export async function updateUserMemory(
  userId: string = 'default_user',
  memoryUpdate: Partial<UserMemory>
): Promise<boolean> {
  // Initialize user memory if it doesn't exist
  if (!memoryStore[userId]) {
    memoryStore[userId] = {};
  }
  
  // Deep merge the memory update with existing memory
  memoryStore[userId] = deepMerge(memoryStore[userId], memoryUpdate);
  
  // In a real application, this would save to a database or API
  return true;
}

// Delete user memory
export async function deleteUserMemory(
  userId: string = 'default_user',
  memoryPath?: string
): Promise<boolean> {
  // If no memory path is provided, delete all user memory
  if (!memoryPath) {
    delete memoryStore[userId];
    return true;
  }
  
  // Otherwise, delete specific memory path
  if (!memoryStore[userId]) {
    return false;
  }
  
  const pathParts = memoryPath.split('.');
  let current = memoryStore[userId];
  
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (current[part] === undefined) {
      return false;
    }
    current = current[part];
  }
  
  const lastPart = pathParts[pathParts.length - 1];
  if (current[lastPart] === undefined) {
    return false;
  }
  
  delete current[lastPart];
  return true;
}

// Helper function for deep merging objects
function deepMerge(target: any, source: any): any {
  const result = { ...target };
  
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      if (isObject(source[key]) && isObject(target[key])) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }
  
  return result;
}

// Helper function to check if a value is an object
function isObject(value: any): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}