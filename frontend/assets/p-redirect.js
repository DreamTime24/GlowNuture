// People who land on /p/<slug> (a crawler-friendly page) are sent into the app. Crawlers and AI agents stay on the HTML.
if (!/bot|crawl|spider|slurp|gpt|claude|perplexity/i.test(navigator.userAgent)) location.replace("/#/p/" + location.pathname.split("/").pop());
