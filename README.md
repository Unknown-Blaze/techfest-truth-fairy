# techfest-truth-fairy

## Ideology
We're manufacturing a browser extension that allows users to flag what they believe to be misinformation, which will be verified by our fact-checking model against credible and reliable sources to gather whether that information is true or not. If it's misinformation, it will be highlighted on that webpage and users can continue to scour the internet with their Chrome web extension enabled. Now, we do this and have comments or some sort of a forum or something behind the highlights that allows users to even debate or chat about what they believe is misinformation when they flag it. When they enable the browser extension, all of the highlighted text on the page has been flagged for possible misinformation and they can investigate further to see people's thoughts or discussions on that subject underneath. So, it spurs discussions amongst users on the internet and it'll also be a legitimate way to verify information online with our AI model in the background. Further extensions could include color-coded highlights to specify specific types of misinformation, perhaps even employing the model on user's comments to ensure there's no misinformation being spread there either and flagging that or preventing it entirely, maybe even a factual statements only forum. We can bring up an elongated panel, spanning maybe like ¼ of the screen, containing all of this information in almost a GUI-like format, enabling users to comment in real-time and send posts back and forth discussing the annotation and fact-checking together in real-time. Additional features would include:
- Misinformation score rendered for each statement (perhaps would consult another model, or have some algorithm to determine a score)
- If the users flag something that doesn't seem to be misinformation, we need something for that as well right? We could maybe highlight that text region temporarily green to show there's no misinformation detected, and perhaps even a little textual pop-up reaffirming that it's true with some additional information on the topic they highlighted, maybe even with links to learn more.
- Fact-checking directly applied to comments within the forum as well, just to ensure that only factual statements are being spread, we don’t want to facilitate misinformation as well in the forums.

## Setup environment
conda create --name truth_fairy python=3.12

conda activate truth_fairy

## Link for pretrained weights
[https://drive.google.com/file/d/1wMnUPwN_aSq9ay0qvNaWvzGYFUKfcqbV/view?usp=sharing](https://drive.google.com/file/d/1MIkgpquQK0ZNi3-ZrfZvSmtpC0kX4NiQ/view?usp=sharing)
