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

    # Get the last inserted document in target collection (based on ObjectId timestamp)
    last_doc = target.find_one(sort=[('_id', -1)])
    last_items = last_doc.get('items') if last_doc else None

    for doc in documents:
        existing_doc = target.find_one({'_id': doc['_id']})

        if not existing_doc:
            # No conflict, insert with copiedAt
            doc['copiedAt'] = datetime.utcnow()
            target.insert_one(doc)
            inserted_count += 1
        else:
            # Conflict exists — check if items match the most recent document
            if doc.get('items') == last_items:
                skipped_count += 1
            else:
                # Items differ → insert as new with new _id and timestamp
                doc['_id'] = ObjectId()
                doc['copiedAt'] = datetime.utcnow()
                target.insert_one(doc)
                duplicated_and_new_id_count += 1

    print(f"Inserted: {inserted_count}, Duplicated w/ New ID: {duplicated_and_new_id_count}, Skipped: {skipped_count}")

    # Export source documents to JSON for reference
    with open(EXPORT_FILE, 'w', encoding='utf-8') as f:
        f.write(dumps(documents, indent=2))

    print(f"Exported source documents to '{EXPORT_FILE}'.\n")

# Schedule job every 10 seconds
schedule.every(10).seconds.do(copy_and_export)

print("Starting periodic MongoDB copy/export task (Ctrl+C to stop)...")
while True:
    schedule.run_pending()
    time.sleep(1)
