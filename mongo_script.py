import json
import time
from pymongo import MongoClient
from bson.objectid import ObjectId
from bson.json_util import dumps
from datetime import datetime
import schedule

# MongoDB config
MONGO_URI = "mongodb://adminShubh:_K1ll3r_@82.112.238.93:27017/?authSource=admin"
DATABASE_NAME = "test"
SOURCE_COLLECTION = "carts"
TARGET_COLLECTION = "orders"
EXPORT_FILE = "copied_data.json"

def copy_and_export():
    client = MongoClient(MONGO_URI)
    db = client[DATABASE_NAME]
    source = db[SOURCE_COLLECTION]
    target = db[TARGET_COLLECTION]

    documents = list(source.find())

    if not documents:
        print("No documents to copy.")
        return

    inserted_count = 0

    for doc in documents:
        original_id = doc['_id']  # keep the original ID for deletion

        # Assign new _id and timestamp
        doc['_id'] = ObjectId()
        doc['copiedAt'] = datetime.utcnow()

        # Insert into target collection
        target.insert_one(doc)
        inserted_count += 1

        # Delete from source collection
        source.delete_one({'_id': original_id})

    print(f"Inserted and removed from carts: {inserted_count}")

    # Export original carts before deletion
    with open(EXPORT_FILE, 'w', encoding='utf-8') as f:
        f.write(dumps(documents, indent=2))

    print(f"Exported source documents to '{EXPORT_FILE}'.")

# Schedule job every 10 seconds
schedule.every(10).seconds.do(copy_and_export)

print("Starting periodic MongoDB copy/export task (Ctrl+C to stop)...")
while True:
    schedule.run_pending()
    time.sleep(1)