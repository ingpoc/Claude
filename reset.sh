#!/bin/bash

# Script to clean and rebuild the Next.js project

echo "Cleaning project..."
rm -rf .next
rm -rf node_modules
rm -rf .cache

echo "Installing dependencies..."
npm install

echo "Starting development server..."
npm run dev