import { NextResponse } from 'next/server';

// This is a stub for Next.js development source map requests
// It prevents 404 errors in the browser console during development

export async function POST() {
  // Return empty stack frame data
  return NextResponse.json({
    originalStackFrame: {
      file: '',
      methodName: '',
      lineNumber: 0,
      column: 0
    },
    originalCodeFrame: null
  });
}
