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
    skipped_count = 0
    duplicated_and_new_id_count = 0

    for doc in documents:
        user_id = doc.get('userId')

        # Find the most recent document from this user
        last_user_doc = target.find_one({'userId': user_id}, sort=[('_id', -1)])

        # Compare items
        if last_user_doc and last_user_doc.get('items') == doc.get('items'):
            skipped_count += 1
            continue

        # Insert new doc with new ID and timestamp
        doc['_id'] = ObjectId()  # force new ID
        doc['copiedAt'] = datetime.utcnow()
        target.insert_one(doc)
        duplicated_and_new_id_count += 1

    print(f"Inserted: {duplicated_and_new_id_count}, Skipped (duplicate items for same user): {skipped_count}")

    # Export source documents to JSON
    with open(EXPORT_FILE, 'w', encoding='utf-8') as f:
        f.write(dumps(documents, indent=2))

    print(f"Exported source documents to '{EXPORT_FILE}'.")

# Schedule job every 10 seconds
schedule.every(10).seconds.do(copy_and_export)

print("Starting periodic MongoDB copy/export task (Ctrl+C to stop)...")
while True:
    schedule.run_pending()
    time.sleep(1)