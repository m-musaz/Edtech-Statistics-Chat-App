import os
from dotenv import load_dotenv

# Load environment variables from .env.test BEFORE any tests run
# This happens once when pytest starts up.
print("Loading .env.test for pytest...")
load_dotenv(dotenv_path=".env.test")
print(f"ALLOWED_HOSTS is now: {os.getenv('ALLOWED_HOSTS')}")