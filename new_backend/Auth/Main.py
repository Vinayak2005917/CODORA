from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import hashlib


# Load env
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", 7))

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
MAX_BCRYPT_LENGTH = 72

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic model
class AuthData(BaseModel):
    username: str
    password: str

# Password helpers
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hashlib.sha256(password.encode("utf-8")).hexdigest() == hashed

# JWT helpers
def create_jwt(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=JWT_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt(token: str) -> str:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None

# Login / auto-register
@app.post("/login")
def login_or_register(data: AuthData, response: Response):
    try:
        # Look for existing user
        res = supabase.table("users").select("*").eq("username", data.username).execute()
        
        if not res.data or len(res.data) == 0:
            # Create new user
            hashed = hash_password(data.password)
            insert_res = supabase.table("users").insert({
                "username": data.username,
                "password_hash": hashed
            }).execute()
            
            if not insert_res.data or len(insert_res.data) == 0:
                raise HTTPException(status_code=500, detail="Failed to create user")
            user_id = insert_res.data[0].get("id")
        else:
            # User exists, verify password
            user = res.data[0]
            if not verify_password(data.password, user["password_hash"]):
                raise HTTPException(status_code=401, detail="Invalid username or password")
            user_id = user.get("id")

        # Create JWT
        token = create_jwt(user_id)

        # Set JWT cookie
        response.set_cookie(
            key="token",
            value=token,
            httponly=True,
            max_age=JWT_EXPIRE_DAYS * 24 * 60 * 60,
            samesite="lax"
        )

        return {"message": "Login successful", "token": token}

    except Exception as e:
        print("Login/register error:", e)  # Debug log
        raise HTTPException(status_code=500, detail=str(e))


