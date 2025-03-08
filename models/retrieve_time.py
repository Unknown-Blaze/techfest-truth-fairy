import requests
from bs4 import BeautifulSoup

# Function to extract the date of publication
def get_publish_date(url):
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')

    # Searching the meta tags for published_time
    meta_date = soup.find('meta', {'property': 'article:published_time'})
    if meta_date:
        return meta_date['content']  # Return the date from the meta tag
    
    meta_date = soup.find('meta', {'name': 'date'})
    if meta_date:
        return meta_date['content']
    
    # Try extracting the publication date from structured data (JSON-LD)
    json_ld = soup.find('script', {'type': 'application/ld+json'})
    # print(json_ld)
    if json_ld:
        import json
        data = json.loads(json_ld.string)
        print(data)
        if isinstance(data, dict):
            if 'mainEntity' in data:
                return data['mainEntity']['dateModified']
            elif 'dateModified' in data:
                return data['dateModified']
        elif isinstance(data, list):
            for item in data:
                if '@type' in item and item['@type'] == 'Article' and 'datePublished' in item:
                    return item['dateModified']
        elif '@type' in data and data['@type'] == 'Article' and 'datePublished' in data:
            return data['dateModified']
    
    return None  # Return None if no date is found

url = 'https://x.com/TheNBACentel/status/1894550791626657818/'
publish_date = get_publish_date(url)
print(publish_date)