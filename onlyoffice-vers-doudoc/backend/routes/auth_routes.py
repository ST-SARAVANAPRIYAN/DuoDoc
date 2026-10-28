"""
Authentication & User Management Routes.
Supports JWT tokens, user registration, login, and role switching.
"""

import time
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr
from jose import jwt, JWTError
from bson import ObjectId

from database.mongodb import get_db, verify_password, get_password_hash

SECRET_KEY = "documind-secret-key-development-multimodal-ai"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_SECONDS = 86400 * 7  # 7 days

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    name: Optional[str] = None
    role: Optional[str] = "user"  # user | admin


class LoginRequest(BaseModel):
    username: str  # username or email
    password: str


class SwitchRoleRequest(BaseModel):
    role: str  # user | admin


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = time.time() + ACCESS_TOKEN_EXPIRE_SECONDS
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(authorization: Optional[str] = Header(None)):
    """
    Dependency extracting current user from Bearer JWT token.
    Falls back to default demo user ('saravana') if unauthenticated.
    """
    db = get_db()
    if db is None:
        return {"username": "saravana", "role": "user", "name": "Saravana Priyan S T", "id": "system"}

    if isinstance(authorization, str) and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            if user_id:
                query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"username": user_id}
                user = db["users"].find_one(query)
                if user:
                    user["id"] = str(user.get("_id", user_id))
                    user.pop("_id", None)
                    user.pop("password_hash", None)
                    return user
        except Exception:
            pass

    # Fallback to default demo user
    try:
        user = db["users"].find_one({"username": "saravana"})
        if user:
            user["id"] = str(user.get("_id", "system"))
            user.pop("_id", None)
            user.pop("password_hash", None)
            return user
    except Exception:
        pass

    return {"username": "saravana", "role": "user", "name": "Saravana Priyan S T", "id": "system"}


@router.post("/register")
def register(req: RegisterRequest):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection unavailable.")

    users_col = db["users"]
    if users_col.find_one({"username": req.username}):
        raise HTTPException(status_code=400, detail="Username already exists.")
    if users_col.find_one({"email": req.email}):
        raise HTTPException(status_code=400, detail="Email already registered.")

    allowed_roles = {"user", "admin"}
    role = req.role if req.role in allowed_roles else "user"

    res = users_col.insert_one({
        "username": req.username,
        "email": req.email,
        "name": req.name or req.username,
        "role": role,
        "password_hash": get_password_hash(req.password),
        "created_at": time.time()
    })

    user_id = str(res.inserted_id)
    token = create_access_token({"sub": user_id, "username": req.username, "role": role})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "username": req.username,
            "email": req.email,
            "name": req.name or req.username,
            "role": role
        }
    }


@router.post("/login")
def login(req: LoginRequest):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection unavailable.")

    users_col = db["users"]
    # Allow login by username or email
    user = users_col.find_one({
        "$or": [{"username": req.username}, {"email": req.username}]
    })

    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    user_id = str(user["_id"])
    token = create_access_token({"sub": user_id, "username": user["username"], "role": user.get("role", "user")})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "username": user["username"],
            "email": user["email"],
            "name": user.get("name", user["username"]),
            "role": user.get("role", "user")
        }
    }


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}


@router.post("/switch-role")
def switch_role(req: SwitchRoleRequest, current_user: dict = Depends(get_current_user)):
    """
    Switch active role between user and admin.
    """
    db = get_db()
    allowed_roles = {"user", "admin"}
    if req.role not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Role must be one of {allowed_roles}")

    target_user = dict(current_user)
    target_user["role"] = req.role

    if db is not None:
        try:
            # Switch between demo accounts if applicable
            if req.role == "admin":
                admin_user = db["users"].find_one({"username": "admin"})
                if admin_user:
                    target_user = {
                        "id": str(admin_user.get("_id", "admin")),
                        "username": admin_user["username"],
                        "email": admin_user.get("email", "admin@mkce.ac.in"),
                        "name": admin_user.get("name", "System Administrator"),
                        "role": "admin"
                    }
            elif req.role == "user":
                user_rec = db["users"].find_one({"username": "saravana"})
                if user_rec:
                    target_user = {
                        "id": str(user_rec.get("_id", "saravana")),
                        "username": user_rec["username"],
                        "email": user_rec.get("email", "saravana@mkce.ac.in"),
                        "name": user_rec.get("name", "Saravana Priyan S T"),
                        "role": "user"
                    }
            elif current_user.get("id") and current_user["id"] != "system":
                if ObjectId.is_valid(current_user["id"]):
                    db["users"].update_one(
                        {"_id": ObjectId(current_user["id"])},
                        {"$set": {"role": req.role}}
                    )
        except Exception:
            pass

    token = create_access_token({"sub": target_user.get("id", "system"), "username": target_user.get("username", "user"), "role": req.role})

    return {
        "access_token": token,
        "user": target_user,
        "message": f"Active role successfully switched to {req.role.upper()}."
    }
