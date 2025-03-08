import requests
from dotenv import load_dotenv
import os

load_dotenv()

def search_brave(query):
    api_key = os.getenv("BRAVE_API_KEY")
    if not api_key:
        raise ValueError("BRAVE_API_KEY is missing! Ensure you have set it in your environment variables.")
    
    url = "https://api.search.brave.com/res/v1/web/search"
    headers = {"X-Subscription-Token": api_key}
    params = {"q": query}
    response = requests.get(url, headers=headers, params=params)
    
    if response.status_code == 200:
        return response.json()['web']['results']
    else:
        print(f"Error: {response.status_code}")
        return None