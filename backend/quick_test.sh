#!/bin/bash

# Quick Backend Test Script
# Usage: chmod +x quick_test.sh && ./quick_test.sh

set -e

echo ""
echo "🔍 QUICK BACKEND TEST"
echo "===================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="${API_URL:-http://localhost:8000}"

echo -e "${BLUE}Testing: $API_URL${NC}"
echo ""

# Test 1: Health Check
echo -e "${YELLOW}1. Health Check...${NC}"
HEALTH=$(curl -s $API_URL/ 2>/dev/null || echo "FAIL")

if [[ $HEALTH == *"SOURCED API"* ]]; then
    echo -e "${GREEN}✓ Backend is running!${NC}"
    echo "   Response: $HEALTH"
else
    echo -e "${RED}✗ Backend not responding${NC}"
    echo "   Make sure backend is running: uvicorn main:app --reload"
    exit 1
fi

echo ""

# Test 2: Check if items endpoint exists
echo -e "${YELLOW}2. Checking /create-catalog-item endpoint...${NC}"

# Try with invalid data to see if endpoint exists
ENDPOINT_TEST=$(curl -s -X POST $API_URL/create-catalog-item \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\n%{http_code}" 2>/dev/null)

HTTP_CODE=$(echo "$ENDPOINT_TEST" | tail -n1)

if [ "$HTTP_CODE" = "422" ] || [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "500" ]; then
    echo -e "${GREEN}✓ Endpoint exists (got validation error as expected)${NC}"
    echo "   HTTP Code: $HTTP_CODE"
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${RED}✗ Endpoint not found (404)${NC}"
    echo "   Make sure items router is included in main.py"
    exit 1
else
    echo -e "${GREEN}✓ Endpoint exists${NC}"
    echo "   HTTP Code: $HTTP_CODE"
fi

echo ""

# Test 3: Check environment variables
echo -e "${YELLOW}3. Checking environment variables...${NC}"

if [ -f .env ]; then
    echo -e "${GREEN}✓ .env file exists${NC}"

    if grep -q "OPENAI_API_KEY" .env; then
        echo -e "${GREEN}✓ OPENAI_API_KEY found${NC}"
    else
        echo -e "${RED}✗ OPENAI_API_KEY missing in .env${NC}"
    fi

    if grep -q "SUPABASE_URL" .env; then
        echo -e "${GREEN}✓ SUPABASE_URL found${NC}"
    else
        echo -e "${RED}✗ SUPABASE_URL missing in .env${NC}"
    fi

    if grep -q "SUPABASE_SERVICE_ROLE_KEY" .env; then
        echo -e "${GREEN}✓ SUPABASE_SERVICE_ROLE_KEY found${NC}"
    else
        echo -e "${RED}✗ SUPABASE_SERVICE_ROLE_KEY missing in .env${NC}"
    fi
else
    echo -e "${RED}✗ .env file not found${NC}"
    echo "   Create .env file with required variables"
fi

echo ""

# Test 4: File structure check
echo -e "${YELLOW}4. Checking file structure...${NC}"

if [ -f "main.py" ]; then
    echo -e "${GREEN}✓ main.py exists${NC}"
else
    echo -e "${RED}✗ main.py not found${NC}"
fi

if [ -d "routers" ]; then
    echo -e "${GREEN}✓ routers/ directory exists${NC}"

    if [ -f "routers/items.py" ]; then
        echo -e "${GREEN}✓ routers/items.py exists${NC}"
    else
        echo -e "${RED}✗ routers/items.py not found${NC}"
        echo "   Copy items_router.py to routers/items.py"
    fi
else
    echo -e "${RED}✗ routers/ directory not found${NC}"
fi

echo ""

# Summary
echo "===================="
echo -e "${BLUE}NEXT STEPS:${NC}"
echo ""
echo "1. Get test IDs from Supabase:"
echo "   SELECT id FROM profiles LIMIT 1;"
echo "   SELECT id FROM catalogs LIMIT 1;"
echo ""
echo "2. Test with real data:"
echo "   curl -X POST $API_URL/create-catalog-item \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{"
echo "       \"catalog_id\": \"YOUR_CATALOG_ID\","
echo "       \"title\": \"Nike Air Max\","
echo "       \"image_url\": \"https://images.unsplash.com/photo-1542291026-7eec264c27ff\","
echo "       \"product_url\": \"https://nike.com\","
echo "       \"price\": \"$185\","
echo "       \"user_id\": \"YOUR_USER_ID\""
echo "     }'"
echo ""
echo -e "${GREEN}Backend health check complete!${NC}"
echo ""