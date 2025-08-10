# SamwiseOS

### An AI-centric operating system built with relentless optimism.

This project is a bold exploration into creating a unique, web-based operating system where the primary interface is a generative AI. It's a testament to what we can achieve with a can-do attitude, a lot of heart, and a little help from our friends (even the digital ones!).

## What is this?

SamwiseOS is a web-based operating system designed from the ground up to be AI-first. Instead of a traditional GUI or a simple command line, you interact with the system through a conversation with an AI. The AI can understand complex commands, create and manage files, and even write and execute code on your behalf. The entire OS is a single-page application that runs right in your browser.

## The Hybrid Kernel: Our Superpower

SamwiseOS is a new genre of operating system: a **Hybrid Web OS**.

Our architecture is a deliberate fusion of two powerful environments. We combine a robust, sandboxed **Python kernel** running in WebAssembly with a nimble **JavaScript frontend** that has direct access to browser APIs. This isn't a compromise; it's our greatest strength.

- **The Python Kernel:** Handles the heavy lifting. All core logic for the virtual file system, user and group management, process control, and complex data manipulation lives here. It's secure, stateful, and the single source of truth for the OS.

- **The JavaScript Stage Manager:** Interacts with the world outside the sandbox. It handles everything that makes the OS feel alive and connected, including the terminal UI, sound synthesis, peer-to-peer networking, and graphical applications.


### How It Works: The `effect` Contract

The magic happens through a simple, powerful contract. When a command needs to interact with the browser, the Python kernel doesn't perform the action itself. Instead, it validates the request and returns a JSON object called an `effect`.

For example, when you run `play C4 4n`:

1. The command is sent to the Python kernel.

2. `play.py` validates the arguments.

3. It returns an effect: `{"effect": "play_sound", "notes": ["C4"], "duration": "4n"}`.

4. The JavaScript `CommandExecutor` receives this object.

5. Its `_handleEffect` function interprets the request and calls the JavaScript `SoundManager` to play the note through the browser's audio API.


This model gives us the best of both worlds: the structured, robust environment of Python and the rich, interactive capabilities of the browser.

### The Future is Weird and Wonderful

This hybrid model opens up incredible possibilities. Because our "hardware" is the web browser, we can dream of integrating features that traditional operating systems can't easily touch:

- **WebGPU:** For powerful, hardware-accelerated graphics and computation.

- **WebSockets & WebRTC:** For seamless, real-time networking.

- **WebUSB & WebBluetooth:** For direct interaction with hardware devices.

- **WebXR:** For immersive augmented and virtual reality experiences.


In SamwiseOS, the browser isn't just a host; it's the motherboard.

---

## Features

We've been hard at work, and I am thrilled to present our progress!

- **Brand New Onboarding!** A friendly, guided setup process to create your user account and secure the `root` password. It's the "Harvest Festival" of first-time user experiences!

- **AI-Powered Shell:** Interact with the OS using natural language. Ask it to find files, write code, or summarize documents for you.

- **Python Backend, JS Frontend:** A powerful and unique combination running entirely in your browser.

- **Self-Contained & Offline-First:** All dependencies, including the Python runtime and packages, are bundled with the app. No internet connection required after the initial setup!

- **Persistent File System:** Your files and directory structure are saved locally to your browser's IndexedDB.

- **Rich Command Set:** A growing list of standard POSIX-like commands (e.g., `ls`, `cat`, `grep`, `mkdir`) and custom AI-powered commands like `forge` and `storyboard`.

- **GUI Applications:** It's not just a terminal! SamwiseOS supports graphical applications like a text editor (`edit`), file explorer (`explore`), and even a paint program (`paint`).

- **User and Group Management:** A robust, secure system for managing users and groups, complete with `sudo` capabilities.


## How to Run

1. **Clone the repository.**

2. **Download Pyodide:**

    - Go to the [Pyodide releases page](https://github.com/pyodide/pyodide/releases).

    - Download the latest full release file.

    - Extract the contents and copy them into the `dist/pyodide/` directory. (Follow the instructions in `dist/pyodide/README.md`).

3. **Run a local web server** in the project's root directory. A simple way to do this is with Python:

   Bash

    ```
    python -m http.server
    ```

4. Open your browser and navigate to the server's address (e.g., `http://localhost:8000`).


---

This is more than just an OS; it's a project built with passion, dedication, and a belief in making things better. Thank you for being a part of it. Now, let's get to work!