import os
import logging
import json
from pathlib import Path
from typing import Generator
from datetime import datetime, timedelta
import httpx
from dotenv import load_dotenv

load_dotenv(override=True)
logger = logging.getLogger(__name__)

# ── Supported file types ───────────────────────────────────────────────────────
TRANSCRIPT_EXTENSIONS = {".txt", ".vtt", ".srt", ".json", ".md", ".pdf", ".docx"}
AUDIO_EXTENSIONS      = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"}
VIDEO_EXTENSIONS      = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}
ALL_SUPPORTED         = TRANSCRIPT_EXTENSIONS | AUDIO_EXTENSIONS | VIDEO_EXTENSIONS

TOKEN_FILE = "tokens.json"

def _load_tokens():
    if os.path.exists(TOKEN_FILE):
        try:
            with open(TOKEN_FILE, "r") as f:
                return json.load(f)
        except:
            return None
    return None

def _save_tokens(tokens):
    with open(TOKEN_FILE, "w") as f:
        json.dump(tokens, f)

def get_auth_url():
    client_id = os.getenv("BOX_CLIENT_ID")
    redirect_uri = os.getenv("BOX_CALLBACK_URL")
    return f"https://account.box.com/api/oauth2/authorize?response_type=code&client_id={client_id}&redirect_uri={redirect_uri}"

async def handle_callback(code: str):
    client_id = os.getenv("BOX_CLIENT_ID")
    client_secret = os.getenv("BOX_CLIENT_SECRET")
    redirect_uri = os.getenv("BOX_CALLBACK_URL")

    url = "https://api.box.com/oauth2/token"
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, data=data)
        resp.raise_for_status()
        tokens = resp.json()
        # Add expiry timestamp
        tokens["expires_at"] = (datetime.now() + timedelta(seconds=tokens["expires_in"])).isoformat()
        _save_tokens(tokens)
        return tokens

def _refresh_tokens(refresh_token: str):
    client_id = os.getenv("BOX_CLIENT_ID")
    client_secret = os.getenv("BOX_CLIENT_SECRET")

    url = "https://api.box.com/oauth2/token"
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id,
        "client_secret": client_secret
    }

    with httpx.Client() as client:
        resp = client.post(url, data=data)
        resp.raise_for_status()
        tokens = resp.json()
        tokens["expires_at"] = (datetime.now() + timedelta(seconds=tokens["expires_in"])).isoformat()
        _save_tokens(tokens)
        return tokens

def _get_headers() -> dict:
    """Validate OAuth config and return headers with Bearer token authentication."""
    # Try to load from tokens.json first
    tokens = _load_tokens()
    
    if tokens:
        # Check if expired
        expires_at = datetime.fromisoformat(tokens["expires_at"])
        if datetime.now() + timedelta(minutes=5) > expires_at:
            # Refresh synchronously
            try:
                tokens = _refresh_tokens(tokens["refresh_token"])
            except Exception as e:
                logger.error("Failed to refresh Box token: %s", e)
                # Fallback to dev token if available
                pass
        
        if tokens and "access_token" in tokens:
            return {
                "Authorization": f"Bearer {tokens['access_token']}",
                "Accept": "application/json"
            }

    # Fallback to developer token
    dev_token = os.getenv("BOX_DEVELOPER_TOKEN")
    client_id = os.getenv("BOX_CLIENT_ID")
    client_secret = os.getenv("BOX_CLIENT_SECRET")

    if not dev_token and not tokens:
        raise ValueError(
            "Neither OAuth tokens nor BOX_DEVELOPER_TOKEN found.\n"
            "Please log in via the Auth screen or provide a developer token."
        )

    return {
        "Authorization": f"Bearer {dev_token}",
        "Accept": "application/json"
    }


def _walk_folder(folder_id: str, path: str = "/") -> Generator[dict, None, None]:
    """
    Recursively yield file metadata dicts for all supported files in a Box folder.
    Each dict: {id, name, path, extension, type_group, size}
    """
    headers = _get_headers()
    url = f"https://api.box.com/2.0/folders/{folder_id}/items"
    
    try:
        with httpx.Client(headers=headers, timeout=30.0) as client:
            offset = 0
            limit = 500
            while True:
                response = client.get(url, params={"limit": limit, "offset": offset, "fields": "id,type,name,size,modified_at"})
                response.raise_for_status()
                data = response.json()
                
                items = data.get("entries", [])
                if not items:
                    break
                    
                for item in items:
                    if item["type"] == "folder":
                        yield from _walk_folder(item["id"], f"{path}{item['name']}/")
                    elif item["type"] == "file":
                        ext = Path(item["name"]).suffix.lower()
                        if ext in ALL_SUPPORTED:
                            group = (
                                "transcript" if ext in TRANSCRIPT_EXTENSIONS else
                                "audio"      if ext in AUDIO_EXTENSIONS      else
                                "video"
                            )
                            yield {
                                "id":          item["id"],
                                "name":        item["name"],
                                "path":        f"{path}{item['name']}",
                                "extension":   ext,
                                "type_group":  group,
                                "size":        item.get("size", 0),
                                "modified_at": item.get("modified_at"),
                            }
                
                offset += limit
                if offset >= data.get("total_count", 0):
                    break
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            logger.error("BOX AUTHENTICATION FAILED: Your Developer Token has likely expired.")
            logger.error("Please generate a fresh token at https://app.box.com/developers/console and update BOX_DEVELOPER_TOKEN in your .env file.")
        else:
            logger.error("Error walking folder %s: HTTP %s - %s", folder_id, exc.response.status_code, exc.response.text)
    except Exception as exc:
        logger.error("Error walking folder %s: %s", folder_id, exc)


def get_all_files() -> list[dict]:
    """
    Return all supported files from BOX_ROOT_FOLDER_ID.
    Transcripts are listed first (preferred over audio/video duplicates).
    """
    root_folder_id = os.getenv("BOX_ROOT_FOLDER_ID", "0")

    files = list(_walk_folder(root_folder_id))

    # Sort: transcripts first so we skip media when a transcript already exists
    order = {"transcript": 0, "audio": 1, "video": 2}
    files.sort(key=lambda f: order.get(f["type_group"], 3))

    logger.info("Box scan found %d relevant file(s) in folder '%s'", len(files), root_folder_id)
    return files


def download_file(file_id: str) -> bytes:
    """Download a Box file by ID and return raw bytes."""
    headers = _get_headers()
    url = f"https://api.box.com/2.0/files/{file_id}/content"
    
    with httpx.Client(headers=headers, follow_redirects=True, timeout=60.0) as client:
        response = client.get(url)
        response.raise_for_status()
        return response.content


def get_folder_structure() -> list[dict]:
    """
    Return a lightweight folder tree for the sidebar UI (max depth 3).
    """
    root_folder_id = os.getenv("BOX_ROOT_FOLDER_ID", "0")
    headers = _get_headers()

    def walk_dirs(folder_id: str, depth: int = 0) -> list[dict]:
        if depth > 3:
            return []
        
        url = f"https://api.box.com/2.0/folders/{folder_id}/items"
        try:
            with httpx.Client(headers=headers, timeout=10.0) as client:
                response = client.get(url, params={"limit": 500, "fields": "id,type,name"})
                response.raise_for_status()
                data = response.json()
                
                result = []
                for item in data.get("entries", []):
                    if item["type"] == "folder":
                        result.append({
                            "id":       item["id"],
                            "name":     item["name"],
                            "children": walk_dirs(item["id"], depth + 1),
                        })
                return result
        except Exception as exc:
            logger.warning("Could not list folder %s: %s", folder_id, exc)
            return []

    # Get root folder name directly
    try:
        with httpx.Client(headers=headers, timeout=10.0) as client:
            root_resp = client.get(f"https://api.box.com/2.0/folders/{root_folder_id}", params={"fields": "id,name"})
            root_resp.raise_for_status()
            root_name = root_resp.json().get("name", "Root")
    except Exception:
        root_name = "Root"

    return [{
        "id":       root_folder_id,
        "name":     root_name,
        "children": walk_dirs(root_folder_id),
    }]


def search_box(query: str, limit: int = 10) -> list[dict]:
    """
    Search Box for files matching the query within BOX_ROOT_FOLDER_ID.
    Returns a list of dicts with file metadata.
    """
    headers = _get_headers()
    folder_id = os.getenv("BOX_ROOT_FOLDER_ID", "0")
    url = "https://api.box.com/2.0/search"
    
    params = {
        "query": query,
        "ancestor_folder_ids": folder_id,
        "type": "file",
        "limit": limit,
        "fields": "id,name,extension,size,item_collection"
    }

    try:
        with httpx.Client(headers=headers, timeout=30.0) as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            results = []
            for item in data.get("entries", []):
                ext = Path(item["name"]).suffix.lower()
                if ext in ALL_SUPPORTED:
                    group = (
                        "transcript" if ext in TRANSCRIPT_EXTENSIONS else
                        "audio"      if ext in AUDIO_EXTENSIONS      else
                        "video"
                    )
                    
                    # Construct a path based on parent folders if available
                    path = "/"
                    if "item_collection" in item and "entries" in item["item_collection"]:
                        path_parts = [p["name"] for p in item["item_collection"]["entries"] if p["id"] != "0"]
                        if path_parts:
                            path = "/" + "/".join(path_parts) + "/"
                    
                    results.append({
                        "id":         item["id"],
                        "name":       item["name"],
                        "path":       f"{path}{item['name']}",
                        "extension":  ext,
                        "type_group": group,
                        "size":       item.get("size", 0),
                    })
            return results
    except Exception as exc:
        logger.error("Error searching Box for '%s': %s", query, exc)
        return []


def upload_file(folder_id: str, file_name: str, file_bytes: bytes) -> dict | None:
    """
    Upload a transcript file back to Box.
    Returns the uploaded file metadata dict or None if it fails.
    """
    headers = _get_headers()
    # Box requires multipart/form-data for uploads.
    # The attributes part needs to be JSON string.
    url = "https://upload.api.box.com/2.0/files/content"
    
    import json
    attributes = json.dumps({
        "name": file_name,
        "parent": {"id": folder_id}
    })
    
    files = {
        'attributes': (None, attributes, 'application/json'),
        'file': (file_name, file_bytes, 'application/octet-stream')
    }

    try:
        with httpx.Client(headers=headers, timeout=60.0) as client:
            response = client.post(url, files=files)
            # If 409 Conflict, it means the file already exists. We can optionally get the existing file.
            if response.status_code == 409:
                logger.warning("Upload conflict: %s already exists in folder %s.", file_name, folder_id)
                # Attempt to retrieve existing ID from conflict context
                conflict_data = response.json().get("context_info", {}).get("conflicts", [])
                if conflict_data:
                    return conflict_data[0]
                return None
            
            response.raise_for_status()
            data = response.json()
            if "entries" in data and data["entries"]:
                return data["entries"][0]
            return None
    except Exception as exc:
        logger.error("Failed to upload file %s to Box: %s", file_name, exc)
        return None
