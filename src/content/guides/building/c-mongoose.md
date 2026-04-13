---
title: Making an API in C (with Mongoose)
description: Build a simple API using the Mongoose library in C
order: 2
author: SamhithPola2025
---

This guide is aimed towards people who want to build their **own API in C**!
Before we start, it would be useful to have the [Mongoose documentation](https://mongoose.ws/documentation/) open. I find that it's pretty understandable, even for beginners.

This guide also helps you understand what happens behind the scenes, especially if you’re used to libraries handling most tasks for you.

Please note that unlike Python or some other languages, C is a compiled language, not interpreted.
This means that you will have to re-compile your code every time you want to test it.

If you want a guide on the best setup for debugging and testing code in C, please refer to [this tutorial](https://www.tutorialspoint.com/cprogramming/c_environment_setup.htm). It explains in detail how to set up your C environment and use it with an IDE. I recommend using GCC if you are on Linux or MacOS. If you are on Windows, MSVC via Visual Studio is the best option. Check out [this guide](https://code.visualstudio.com/docs/cpp/config-msvc#_prerequisites) for setup and compiling your project.

To start, please copy [mongoose.c](https://raw.githubusercontent.com/cesanta/mongoose/master/mongoose.c) and the [mongoose.h](https://raw.githubusercontent.com/cesanta/mongoose/master/mongoose.h) header file to your source tree.

Now, make a C file called `main.c` and open it up, let's get some code in here!

```c
#include "mongoose.h" // Including the dependency
#include <time.h> // For time(), we can use this later.

int main() {
    struct mg_mgr mgr; // Mongoose event manager, holds all connections
    mg_mgr_init(&mgr); // Initialize the event manager
    
    // Setup HTTP listener
    mg_http_listen(&mgr, "http://0.0.0.0:8000", fn, NULL);

    while (1) {
        mg_mgr_poll(&mgr, 1000);
    }

    return 0;
}
```

All this code is doing is including the dependency for mongoose you added earlier and basic things like the event manager and setting up an infinite event loop with `while (1)`.

![Diagram of the event loop](https://cdn.hackclub.com/019cc67f-fe11-7c18-9aa6-e09eb914cf86/untitled_diagram.drawio.png)

Mongoose has two basic data structures that you need to know:

- `struct mg_mgr` - An event manager that holds all active connections
- `struct mg_connection` - A single connection descriptor

Now, let's make an event handler function, the above code shouldn't have worked because in this line:
```c
mg_http_listen(&mgr, "http://0.0.0.0:8000", fn, NULL);
```
We pass `fn`, but this is just a placeholder, as we haven’t defined the event handler function yet.

The most basic way to make an event handler function that handles requests would be something like this:

```c
static void ev_handler(struct mg_connection *c, int ev, void *ev_data) {
    if (ev == MG_EV_HTTP_MSG) {  // New HTTP request received
        struct mg_http_message *hm = (struct mg_http_message *) ev_data;

        if (mg_match(hm->uri, mg_str("/api/hello"), NULL)) {
            mg_http_reply(c, 200, "", "{%m:%d}\n", MG_ESC("status"), 1);
        } else {
            struct mg_http_serve_opts opts = 
            {
            .root_dir = ".",
            .fs = &mg_fs_posix
            };
            mg_http_serve_dir(c, hm, &opts);  // Serve static files
        }
    }
}

```

Hint: If it isn’t compiling, you may have defined your function after `main`; either move it above `main` or add a forward declaration.

- `struct mg_http_message *hm = (struct mg_http_message *) ev_data;` - `*` indicates a pointer, storing the memory address of the struct, not the struct itself.  
- `hm` just stands for “HTTP message.”

Syntax Tips: The -> operator is used to access members of a structure or union through a pointer instead of the usual ".". 

> Note that in the line:
> ```c
> struct mg_http_serve_opts opts = {.root_dir = ".", .fs = &mg_fs_posix};
> ```
> `.fs = &mg_fs_posix` tells Mongoose to use the OS filesystem via **POSIX** APIs.
> On Windows, `mg_fs_posix` won’t work natively, you’d either need a **POSIX** layer (WSL, Cygwin) or write a custom mg_fs using Windows API calls.
> Otherwise, you can also serve from memory or a CDN, bypassing the OS filesystem entirely.

Now that you have that function, go ahead and change that line of code from earlier to include the function name:

```c
mg_http_listen(&mgr, "http://0.0.0.0:8000", ev_handler, NULL);
```

Note that HTTPS will not work unless TLS certificates are configured.  
For simplicity, this guide does not cover TLS setup. If you already know how to configure TLS certificates, you can enable HTTPS by creating an HTTPS listener the same way as the HTTP one, but using an `https://` address and attaching your TLS configuration. You can also use a reverse proxy like [Cloudflare](https://raspapi.halceon.dev/guides/hosting/cf-tunnels) Tunnels or [ngrok](https://raspapi.halceon.dev/guides/hosting/ngrok).

Now, you've set up basic code that listens on port 8000, compile it using a command similar to this for Mac or Linux:

```bash
gcc -o main main.c mongoose.c
./main
```

Windows (MSVC `cl`) example:

```bat
cl /W4 main.c mongoose.c /link /OUT:main.exe
main.exe
```

Where main is the executable name, and you are compiling main.c and linking mongoose.c to it.

If you head over to http://localhost:8000, you should see that you have your basic setup done!
What you effectively now have set up is a single route.

## Implementing Different Types of Requests
Right now the simple server you have set up only checks for a single route:

```c
/api/hello
```
If the request matches that path, the server returns a JSON response, otherwise it serves static files.

However, real APIs usually have multiple endpoints and different request types like `GET` and `POST`.

The parsed HTTP request stored in struct mg_http_message contains two important fields:

- `hm->uri` - the request path (for example /api/hello)
- `hm->method` - the HTTP method (GET, POST, etc.)

You can use these to create multiple endpoints. You need at least 3 GET endpoints and 1 POST endpoint to submit your project.

Example:

```c
static void ev_handler(struct mg_connection *c, int ev, void *ev_data) {
  if (ev == MG_EV_HTTP_MSG) {
    struct mg_http_message *hm = (struct mg_http_message *) ev_data;

    // GET /api/hello
    if (mg_match(hm->uri, mg_str("/api/hello"), NULL) &&
        mg_match(hm->method, mg_str("GET"), NULL)) {

      mg_http_reply(c, 200, "Content-Type: application/json\r\n", "{\"message\":\"hello\"}");

    // GET /api/time
    } else if (mg_match(hm->uri, mg_str("/api/time"), NULL) &&
               mg_match(hm->method, mg_str("GET"), NULL)) {

      mg_http_reply(c, 200, "Content-Type: application/json\r\n",
                    "{\"time\": %lu}", (unsigned long) time(NULL));

    // GET /api/status
    } else if (mg_match(hm->uri, mg_str("/api/status"), NULL) &&
               mg_match(hm->method, mg_str("GET"), NULL)) {

      mg_http_reply(c, 200, "Content-Type: application/json\r\n", "{\"status\":\"ok\"}");

    // POST /api/echo
    } else if (mg_match(hm->uri, mg_str("/api/echo"), NULL) &&
               mg_match(hm->method, mg_str("POST"), NULL)) {

      mg_http_reply(c, 200, "Content-Type: application/json\r\n",
                    "{\"you_sent\":\"%.*s\"}",
                    (int) hm->body.len, hm->body.buf);

    } else {
      struct mg_http_serve_opts opts = {.root_dir = ".", .fs = &mg_fs_posix};
      mg_http_serve_dir(c, hm, &opts);
    }
  }
}
```

This code may look complex, but it simply sends different responses for GET and POST requests. Try experimenting with Mongoose to add your own endpoints.

> Note: In formatted I/O functions in C, % is a format specifier where you specify the type, and then write the value afterwards, it can take a bit to get used to.

If you want to learn more about types of API requests, look into [this blog post](https://rehanpinjari.medium.com/understanding-the-different-types-of-api-calls-a-complete-guide-d31cfbf66f89), it explains things in a pretty simple way.

If you want to take a look into the Mongoose documentation, take a look [here](https://mongoose.ws/documentation/) (they have amazing documentation).

## CORS Implementation
CORS (cross-origin-resource-sharing) is a security feature in web browsers that blocks requests to your API from domains of your choice, if you want to let any domain on the internet access your API, add CORS headers to your HTTP responses in the `ev_handler` method:

```c
if (ev == MG_EV_HTTP_MSG) {
    struct mg_http_message *hm = (struct mg_http_message *) ev_data;
    static const char *CORS_HEADERS =
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
        "Access-Control-Allow-Headers: Content-Type\r\n";

    // Handle OPTIONS request for CORS preflight
    if (mg_match(hm->method, mg_str("OPTIONS"), NULL)) {
        mg_http_reply(c, 200, CORS_HEADERS, "");
        return;
    }

    // Include CORS headers in all your responses
    if (mg_match(hm->uri, mg_str("/api/hello"), NULL) &&
        mg_match(hm->method, mg_str("GET"), NULL)) {
        mg_http_reply(c, 200, CORS_HEADERS, "{\"message\":\"hello\"}");
    } else {
        // For other routes, also add CORS_HEADERS as the third parameter
    }
}
```

The `CORS_HEADERS` string is passed as the third parameter to `mg_http_reply()`, ensuring proper HTTP header formatting. The second part handles `OPTIONS` requests, which browsers use to check the CORS policy before making actual requests.

That's it! I hope that with the knowledge you gained from this guide, you figured out how to at least get started.
Next, you should come up with a creative idea (doesn't have to be very complex), and figure out how to integrate the [requirements](https://raspapi.halceon.dev/guides/about) into your project!

If you have any questions, you can message **Samhith (me)** on Slack, and I'd be happy to help with a lot of things!