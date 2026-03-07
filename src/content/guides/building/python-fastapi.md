---
title: Python (with FastAPI and uv)
description: Build a simple API using FastAPI and uv in Python.
order: 1
---

Let's build a simple API with **FastAPI** with Python! Before we get started, make sure you have `uv` [installed](https://docs.astral.sh/uv/getting-started/installation/). This lets us use **virtual environments**, which keeps each project in its own isolated space.

FastAPI automatically generates documentation for your API at `/docs` and `/redoc`, so that's one less requirement to worry about!

To create a new project, create a new directory and navigate into it. Then, run `uv init` to set up a new uv project:

```bash
mkdir myraspapi
cd myraspapi
uv init
```

Next in our terminal, let's install FastAPI and uvicorn (the server that will run our API) into our virtual environment:

```bash
uv add fastapi uvicorn
```

Open that folder in your editor of choice. You'll notice a few files here set up for you. Our code will sit in `main.py`, so let's open it up.

> **Note:** If you ever run into an error such as `ModuleNotFoundError: No module named 'fastapi'`, try running `source .venv/bin/activate` to manually activate the virtual environment created by uv. If you use `uv run` to run your code, this shouldn't occur, but if you use `python main.py` or something similar, you might run into this issue.

Next, let's add some code to `main.py` to create our very first API endpoints!

```python
from fastapi import FastAPI
import uvicorn

app = FastAPI()
@app.get("/hello")
def hello():
    return {"message": "Hello, RaspAPI!"}

uvicorn.run(app)
```

And let's run it:

```bash
uv run main.py --reload
```

> **Note:** The `--reload` flag makes sure the server restarts whenever you make changes to the code. When you deploy your API later, you can remove this.

You should see something like:

```
INFO:     Started server process [712345162]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

Ctrl-click or open `http://localhost:8000/hello` in your browser, and you should see:

```json
{
  "message": "Hello, RaspAPI!"
}
```

Great! You've built your first API endpoint with FastAPI. Now, any Python code you write inside that function will run whenever someone accesses that endpoint.

## CORS

Side note: CORS (Cross-Origin Resource Sharing) is a security feature in web browsers that allows requests to your API from domains of your choice (by default, none). If you want to allow requests from any domain through the browser, make sure to add the following code to your `main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # customize this to only allow certain domains!
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Taking input

How do we take input from users? We can use query, path, and body parameters.

Query parameters are what you see after the "?" in a URL. For example, in Youtube, we have links in the form: `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=19s`. Here, `v` represents the video ID, and `t` represents the timestamp. To parse query parameters, we just add them as function parameters:

```python
@app.get("/double")
def double(x: int):
    return {"result": x * 2}
```

Notice the type hint we added to `x`? FastAPI uses that to automatically validate the input and generate documentation. If you don't provide a value for `x` or if you provide a non-int, it'll error out with a message like this:

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["query", "x"],
      "msg": "Field required",
      "input": null
    }
  ]
}
```

```json
{
  "detail": [
    {
      "type": "int_parsing",
      "loc": ["query", "x"],
      "msg": "Input should be a valid integer, unable to parse string as an integer",
      "input": "abcdef"
    }
  ]
}
```

Path parameters are part of the URL itself, like this: `https://raspapi.halceon.dev/guides/{type}/{guide_id}`. To parse path parameters, we also add them as function parameters, and specify that in the route.

```python
@app.get("/hello/{name}")
def hello_name(name: str):
    return {"message": f"Hello, {name}!"}
```

Body parameters are used when sending more data - you'll need this for your POST request. To parse it, we can use a library called Pydantic, which creates data models and lets us validate against them. Sounds complicated, but it's actually really easy!

```python
from pydantic import BaseModel

class JellyBeans(BaseModel):
    flavor: str
    color: str
    quantity: int

@app.post("/eatbeans")
def eat_jellybeans(jellybeans: JellyBeans):
    return {"message": f"You ate {jellybeans.quantity} {jellybeans.color} {jellybeans.flavor} jellybeans!"}
```

These requests cannot be made easily through the browser, so I would suggest using a tool like Postman/Insomnia/etc. to test them out. My tool of choice is called Yaak, and I've heard good things about Hoppscotch (in-browser) as well.
