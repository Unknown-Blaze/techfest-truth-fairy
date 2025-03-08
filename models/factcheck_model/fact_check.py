from flask import Flask, request, jsonify
import openai
import os
from dotenv import load_dotenv
from rag_brave_pipeline import search_brave
from retrieve_time import get_publish_date

load_dotenv()

api_key = os.getenv("OPENAI_KEY")
if api_key is None:
    raise ValueError(
        "API key is missing! Ensure you have set OPENAI_KEY in your .env file."
    )

app = Flask(__name__)

@app.route("/fact-check", methods=["POST"])
def fact_check():
    data = request.json
    flagged_text = data.get("flagged_text", "")
    flagged_url = data.get("flagged_url", "")

    if not flagged_text:
        return jsonify({"error": "flagged_text is required"}), 400

    # Initialize OpenAI client with the API key
    client = openai.OpenAI(api_key=api_key)

    # First completion - Generating Query for Search API by invoking model
    search_query_completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You will receive textual data that users have flagged on the internet as possible sources of misinformation."
                "You will function as a generator for my search API. I need the user's highlighted text to be transformed into a web query such that the information inside the text can be validated by searching for relevant articles on the Internet."
                "The query should only transform what's present within the textual data and should not manufacture any details."
                "For example, if the statement reads: 'Joe Biden is the president of the U.S.', you need to transform and give me the question: Who is the president of the United States? Understood.",
            },
            {"role": "user", "content": flagged_text},
        ],
    )

    query = search_query_completion.choices[0].message.content
    results = search_brave(query)

    # Increase search context to the first five result descriptions returned by the search API
    search_context = "\n".join([result["description"] for result in results[:5]])
    # timestamp = get_publish_date(url=flagged_url)

    full_context = (
        "Additional Context:"
        + search_context
        + "\nUser Flagged Text: "
        + flagged_text
        # +"\nTimestamp:"
        # + timestamp
        # + "\nArticle Information was derived from: https://www.nature.com/articles/d41586-025-00609-y"
    )

    print(full_context)

    # Make the API call correctly
    fact_check_completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "Your function is that of a lie detector. I will pass additional context to inform your decision, followed by user-highlighted annotations of information widely available on the internet."
                "Users have flagged this text for a possible instance of misinformation. I need you to verify if this information is indeed misinformation or if it's real."
                "When fact-checking, ensure you cross-reference the flagged statement with multiple trusted and up-to-date sources to verify its validity. Avoid relying on a single source unless absolutely necessary."
                "For statements regarding facts that can change over time (e.g., rankings, statistics, or leadership positions), always check if the current data contradicts the claim, but also take into account the publication date of the source to assess if the statement was true at the time of publishing. This infomration will be available in the additional context."
                "Your decision should be made after consulting the additional context provided in the prompt, which could possibly influence your final decision."
                "Even though you consult the context, your focus is purely on validating the user flagged text."
                "The statements made in the additional context are entirely valid, as they're retrieved from current-day search engines. You should not try to falsify those."
                "There's a possibility that the user-highlighted text requires context present within the article, hence you will see the webpage linked as well to further influence your decisions."
                "As of right now, your response should only elicit one of three categories: [Real, Fake, Cannot Verify]."
                "Cannot verify should especially be used in situations where the highlighted text cannot be factually verified or in and of itself doesn't contain a statement that can be fact checked."
                "e.g. The user can highlight opinionated text, which should not proceed through your analysis and should be marked as Cannot Verify."
                "You need to follow your response with justification of how you arrived at that conclusion."
                "I need you to find and return the sources/links validating your justification, so users will know."
                "The output returned needs to be strictly in the JSON format provided: {'category': Chosen one from this list ['Real', 'Fake', 'Cannot Verify'], 'justification': provided justification, 'sources': a list of sources found on the relevant topics}",
            },
            {"role": "user", "content": full_context},
        ],
    )

    return fact_check_completion.choices[0].message.content
