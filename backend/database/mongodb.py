"""
MongoDB Database Connection & Initialization Manager.
Supports users, custom folders, document library metadata, and chat sessions.
"""

import os
import time
import logging
from typing import Dict, Any, List, Optional
from pymongo import MongoClient, ASCENDING
import bcrypt

logger = logging.getLogger("MongoDBManager")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "multimodal_doc_ai")

_CLIENT: Optional[MongoClient] = None
_DB = None


import json
from pathlib import Path
from bson import ObjectId

_LOCAL_DB = None


class LocalCollection:
    def __init__(self, name: str, db: "LocalDatabase"):
        self.name = name
        self.db = db

    def _matches(self, doc: dict, query: dict) -> bool:
        if not query:
            return True
        for k, v in query.items():
            if k == "$or":
                if not any(self._matches(doc, subq) for subq in v):
                    return False
            elif k == "$and":
                if not all(self._matches(doc, subq) for subq in v):
                    return False
            else:
                doc_val = doc.get(k)
                if isinstance(v, dict):
                    if "$regex" in v:
                        import re
                        flags = re.IGNORECASE if "i" in v.get("$options", "") else 0
                        target = str(doc_val or "")
                        if not re.search(v["$regex"], target, flags):
                            return False
                    elif "$in" in v:
                        if doc_val not in v["$in"]:
                            return False
                else:
                    if str(doc_val) != str(v) and doc_val != v:
                        return False
        return True

    def find_one(self, query: dict = None, projection: dict = None) -> Optional[dict]:
        data = self.db._data.get(self.name, [])
        query = query or {}
        for item in data:
            if self._matches(item, query):
                res = dict(item)
                return res
        return None

    def find(self, query: dict = None, projection: dict = None):
        data = self.db._data.get(self.name, [])
        query = query or {}
        results = [dict(item) for item in data if self._matches(item, query)]

        class Cursor(list):
            def sort(self, key, direction=1):
                reverse = direction == -1
                return Cursor(sorted(self, key=lambda x: x.get(key, 0) or 0, reverse=reverse))

            def limit(self, n):
                if n <= 0:
                    return self
                return Cursor(self[:n])

        return Cursor(results)

    def insert_one(self, doc: dict):
        new_doc = dict(doc)
        if "_id" not in new_doc:
            new_doc["_id"] = ObjectId()
        if self.name not in self.db._data:
            self.db._data[self.name] = []
        self.db._data[self.name].append(new_doc)
        self.db._save()

        class InsertResult:
            def __init__(self, inserted_id):
                self.inserted_id = inserted_id

        return InsertResult(new_doc["_id"])

    def update_one(self, query: dict, update: dict, upsert: bool = False):
        data = self.db._data.get(self.name, [])
        target = None
        for item in data:
            if self._matches(item, query):
                target = item
                break

        if target is None and upsert:
            new_doc = dict(query)
            if "$set" in update:
                new_doc.update(update["$set"])
            if "$push" in update:
                for pk, pv in update["$push"].items():
                    new_doc[pk] = [pv]
            self.insert_one(new_doc)
            return

        if target is not None:
            if "$set" in update:
                target.update(update["$set"])
            if "$push" in update:
                for pk, pv in update["$push"].items():
                    if pk not in target or not isinstance(target[pk], list):
                        target[pk] = []
                    target[pk].append(pv)
            self.db._save()

    def update_many(self, query: dict, update: dict):
        data = self.db._data.get(self.name, [])
        for item in data:
            if self._matches(item, query):
                if "$set" in update:
                    item.update(update["$set"])
        self.db._save()

    def delete_one(self, query: dict):
        data = self.db._data.get(self.name, [])
        for i, item in enumerate(data):
            if self._matches(item, query):
                del data[i]
                self.db._save()
                return

    def delete_many(self, query: dict):
        data = self.db._data.get(self.name, [])
        self.db._data[self.name] = [item for item in data if not self._matches(item, query)]
        self.db._save()

    def count_documents(self, query: dict) -> int:
        data = self.db._data.get(self.name, [])
        return sum(1 for item in data if self._matches(item, query))

    def create_index(self, keys, **kwargs):
        pass


class LocalDatabase:
    def __init__(self, filepath: str = "data/local_db.json"):
        self.filepath = filepath
        self._data: Dict[str, List[dict]] = {}
        self._load()

    def _load(self):
        try:
            if os.path.exists(self.filepath):
                with open(self.filepath, "r", encoding="utf-8") as f:
                    raw = json.load(f)
                    # Convert _id strings back to ObjectId
                    for col_name, items in raw.items():
                        for item in items:
                            if "_id" in item and isinstance(item["_id"], str) and len(item["_id"]) == 24:
                                try:
                                    item["_id"] = ObjectId(item["_id"])
                                except Exception:
                                    pass
                    self._data = raw
        except Exception as e:
            logger.warning(f"Failed to load local DB: {e}")
            self._data = {}

    def _save(self):
        try:
            os.makedirs(os.path.dirname(self.filepath), exist_ok=True)
            serializable = {}
            for col_name, items in self._data.items():
                col_list = []
                for item in items:
                    c = dict(item)
                    if "_id" in c:
                        c["_id"] = str(c["_id"])
                    col_list.append(c)
                serializable[col_name] = col_list
            with open(self.filepath, "w", encoding="utf-8") as f:
                json.dump(serializable, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to save local DB: {e}")

    def __getitem__(self, name: str) -> LocalCollection:
        return LocalCollection(name, self)


def get_local_db() -> LocalDatabase:
    global _LOCAL_DB
    if _LOCAL_DB is None:
        _LOCAL_DB = LocalDatabase()
    return _LOCAL_DB


def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        pwd_bytes = plain_password.encode('utf-8')[:72]
        hash_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False


def get_db():
    global _CLIENT, _DB
    if _DB is not None:
        return _DB

    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=1200)
        client.admin.command("ping")
        _CLIENT = client
        _DB = client[DB_NAME]
        logger.info(f"Connected successfully to MongoDB database '{DB_NAME}'.")
        return _DB
    except Exception as e:
        logger.warning(f"MongoDB connection failed: {e}. Falling back to resilient local database mode.")
        if _CLIENT:
            try:
                _CLIENT.close()
            except Exception:
                pass
        _CLIENT = None
        _DB = get_local_db()
        return _DB


def init_db():
    """
    Initializes collections, indexes, demo accounts, and default folders.
    Works seamlessly on both real MongoDB and local fallback database.
    """
    db = get_db()
    if db is None:
        logger.warning("No database available during init_db.")
        return

    # 1. Collections & Indexes
    users_col = db["users"]
    users_col.create_index([("username", ASCENDING)], unique=True)
    users_col.create_index([("email", ASCENDING)], unique=True)

    folders_col = db["folders"]
    folders_col.create_index([("owner_id", ASCENDING), ("name", ASCENDING)])

    docs_col = db["documents"]
    docs_col.create_index([("document_id", ASCENDING)], unique=True)
    docs_col.create_index([("owner_id", ASCENDING)])
    docs_col.create_index([("folder_id", ASCENDING)])

    chat_col = db["chat_sessions"]
    chat_col.create_index([("document_id", ASCENDING)])
    chat_col.create_index([("user_id", ASCENDING)])

    # 2. Seed Default Accounts (Only 2 Roles: user and admin)
    demo_users = [
        {"username": "saravana", "email": "saravana@mkce.ac.in", "role": "user", "name": "Saravana Priyan S T", "pwd": "password123"},
        {"username": "admin", "email": "admin@mkce.ac.in", "role": "admin", "name": "System Administrator", "pwd": "admin123"},
    ]

    for u in demo_users:
        existing = users_col.find_one({"username": u["username"]})
        if not existing:
            users_col.insert_one({
                "username": u["username"],
                "email": u["email"],
                "name": u["name"],
                "role": u["role"],
                "password_hash": get_password_hash(u["pwd"]),
                "created_at": time.time()
            })
            logger.info(f"Seeded demo account '{u['username']}' with role '{u['role']}'.")
        else:
            # Enforce 2-role schema
            if existing.get("role") not in {"user", "admin"}:
                users_col.update_one({"_id": existing["_id"]}, {"$set": {"role": u["role"]}})

    # Remove legacy educator if present
    users_col.delete_many({"username": "educator"})

    # 3. Seed Primary Project Paper into Library if empty (no mock documents)
    default_user = users_col.find_one({"username": "saravana"})
    _seed_initial_project_document(db, default_user)


def _seed_initial_project_document(db, default_user):
    """
    If library is empty, seeds only the legitimate Project Paper document.
    No mock documents, temporary exports, or scratch files are imported.
    """
    docs_col = db["documents"]
    folders_col = db["folders"]
    owner_id = str(default_user["_id"]) if default_user else "system"

    # Ensure a clean default category exists
    ai_folder = folders_col.find_one({"owner_id": owner_id, "name": "AI Papers & Research"})
    if not ai_folder:
        ins = folders_col.insert_one({
            "name": "AI Papers & Research",
            "owner_id": owner_id,
            "color": "#39ff14",
            "icon": "folder",
            "description": "Primary multimodal deep learning research papers and project deliverables.",
            "created_at": time.time()
        })
        folder_id = str(ins.inserted_id)
    else:
        folder_id = str(ai_folder["_id"])

    # If documents collection is empty, register the Project Paper
    if docs_col.count_documents({}) == 0:
        paper_path = "uploads/doc_f6d2656d59_project_paper.docx"
        if os.path.exists(paper_path):
            file_size = os.path.getsize(paper_path)
            docs_col.insert_one({
                "document_id": "doc_f6d2656d59",
                "owner_id": owner_id,
                "folder_id": folder_id,
                "title": "Deep Learning System for Multimodal Document Understanding & Grounded Manipulation",
                "filename": "project_paper.docx",
                "file_type": "docx",
                "file_path": paper_path,
                "file_size": file_size,
                "page_count": 4,
                "tags": ["research", "docx", "project-paper", "multimodal"],
                "status": "ready",
                "uploaded_at": time.time(),
                "last_opened_at": time.time()
            })
            logger.info("Registered clean Project Paper doc_f6d2656d59 in MongoDB.")
