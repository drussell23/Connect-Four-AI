#!/usr/bin/env python3
"""Test integration between all Connect Four services"""

import requests
import json
import time

print("🧪 Testing Connect Four Service Integration")
print("=" * 50)

# Test 1: Check all services are up
services = {
    'Backend': 'http://localhost:3000/health',
    'ML Service': 'http://localhost:8000/health',
    'ML Inference': 'http://localhost:8001/health',
    'AI Coordination': 'http://localhost:8003/health',
    'Python Trainer': 'http://localhost:8004/health'
}

print("\n1️⃣ Service Health Check:")
all_up = True
for name, url in services.items():
    try:
        r = requests.get(url, timeout=2)
        if r.status_code == 200:
            print(f"   ✅ {name}: ONLINE")
        else:
            print(f"   ⚠️  {name}: Status {r.status_code}")
            all_up = False
    except Exception as e:
        print(f"   ❌ {name}: OFFLINE - {type(e).__name__}")
        all_up = False

# Test 2: Create a game and check AI integration
print("\n2️⃣ Testing Game Creation with AI:")
try:
    # Create a game
    game_data = {
        "playerName": "TestPlayer",
        "difficulty": 0.5
    }
    
    r = requests.post('http://localhost:3000/games', json=game_data)
    if r.status_code == 201:
        game = r.json()
        print(f"   ✅ Game created: {game['id']}")
        
        # Test 3: Make a move and check AI response
        print("\n3️⃣ Testing AI Move Generation:")
        move_data = {
            "column": 3,
            "playerId": "TestPlayer"
        }
        
        r = requests.post(f'http://localhost:3000/games/{game["id"]}/drop', json=move_data)
        if r.status_code == 200:
            result = r.json()
            if 'aiMove' in result:
                print(f"   ✅ AI responded with move in column: {result['aiMove']['column']}")
            else:
                print("   ⚠️  No AI move in response")
        else:
            print(f"   ❌ Move failed: {r.status_code}")
    else:
        print(f"   ❌ Game creation failed: {r.status_code}")
        
except Exception as e:
    print(f"   ❌ Integration test failed: {e}")

# Test 4: Check ML Service prediction
print("\n4️⃣ Testing ML Service Direct Prediction:")
try:
    board = [[0] * 7 for _ in range(6)]
    board[5][3] = 1  # Player move
    
    prediction_data = {
        "board": board,
        "model_type": "standard"
    }
    
    r = requests.post('http://localhost:8000/predict', json=prediction_data)
    if r.status_code == 200:
        pred = r.json()
        print(f"   ✅ ML prediction received: {pred['move']['column']}")
    else:
        print(f"   ❌ ML prediction failed: {r.status_code}")
except Exception as e:
    print(f"   ❌ ML test failed: {e}")

# Test 5: Check learning metrics
print("\n5️⃣ Testing Learning System Status:")
try:
    r = requests.get('http://localhost:8000/status/learning')
    if r.status_code == 200:
        status = r.json()
        print(f"   ✅ Learning system active")
        print(f"      Games processed: {status.get('games_processed', 0)}")
        print(f"      Model updates: {status.get('model_updates', 0)}")
    else:
        print(f"   ⚠️  Learning status unavailable")
except:
    print("   ⚠️  Learning endpoint not implemented yet")

print("\n" + "=" * 50)
if all_up:
    print("✅ All services are running and integrated!")
else:
    print("⚠️  Some services need attention")