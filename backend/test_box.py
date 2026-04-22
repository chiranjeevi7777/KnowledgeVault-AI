from box_client import get_all_files, _get_headers
import os
import httpx
import logging

logging.basicConfig(level=logging.DEBUG)

def test_box():
    try:
        headers = _get_headers()
        print(f"Headers configured: bool(Authorization) = {'Authorization' in headers}")
    except Exception as e:
        print("Header error:", e)
        return

    root_id = os.getenv("BOX_ROOT_FOLDER_ID", "0")
    print(f"Root Folder ID: {root_id}")

    try:
        url = f"https://api.box.com/2.0/folders/{root_id}/items"
        with httpx.Client(headers=headers) as client:
            resp = client.get(url, params={"limit": 5, "fields": "id,type,name,size"})
            print(f"Raw response HTTP {resp.status_code}")
            print(resp.text)
    except Exception as e:
        print("Request error:", e)

    print("\nStarting get_all_files()...")
    files = get_all_files()
    print(f"Found {len(files)} files.")
    for f in files:
        print(f)

if __name__ == "__main__":
    test_box()
