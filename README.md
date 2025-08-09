# SamwiseOS

### A GPT-centric operating system

This project is an exploration into creating a unique operating system where the primary interface is a generative AI.

## What is this?

SamwiseOS is a web-based operating system designed from the ground up to be AI-first. Instead of a traditional GUI or a simple command line, the user interacts with the system through a conversation with an AI. The AI can understand complex commands, create and manage files, and even write and execute code on behalf of the user. The entire OS is a single-page application that runs in your browser.

## Why?

The goal is to explore a new paradigm for human-computer interaction. What if, instead of learning complex commands or navigating menus, you could simply tell your computer what you want to do in natural language? This project is a testbed for that idea, pushing the boundaries of what's possible with in-browser AI and WebAssembly.

---

## The Hybrid Kernel: Our Superpower

SamwiseOS is a new genre of operating system: a **Hybrid Web OS**.

Our architecture is a deliberate fusion of two powerful environments. We combine a robust, sandboxed **Python kernel** running in WebAssembly with a nimble **JavaScript frontend** that has direct access to browser APIs. This isn't a compromise; it's our greatest strength.

-   **The Python Kernel:** Handles the heavy lifting. All core logic for the virtual file system, user and group management, process control, and complex data manipulation lives here. It's secure, stateful, and the single source of truth for the OS.

-   **The JavaScript Stage Manager:** Interacts with the world outside the sandbox. It handles everything that makes the OS feel alive and connected, including the terminal UI, sound synthesis, peer-to-peer networking, and graphical applications.

### How It Works: The `effect` Contract

The magic happens through a simple, powerful contract. When a command needs to interact with the browser, the Python kernel doesn't perform the action itself. Instead, it validates the request and returns a JSON object called an `effect`.

For example, when you run `play C4 4n`:
1.  The command is sent to the Python kernel.
2.  `play.py` validates the arguments.
3.  It returns an effect: `{"effect": "play_sound", "notes": ["C4"], "duration": "4n"}`.
4.  The JavaScript `CommandExecutor` receives this object.
5.  Its `_handleEffect` function interprets the request and calls the JavaScript `SoundManager` to play the note through the browser's audio API.

This model gives us the best of both worlds: the structured, robust environment of Python and the rich, interactive capabilities of the browser.

### The Future is Weird and Wonderful

This hybrid model opens up incredible possibilities. Because our "hardware" is the web browser, we can dream of integrating features that traditional operating systems can't easily touch:

-   **WebGPU:** For powerful, hardware-accelerated graphics and computation.
-   **WebSockets & WebRTC:** For seamless, real-time networking.
-   **WebUSB & WebBluetooth:** For direct interaction with hardware devices.
-   **WebXR:** For immersive augmented and virtual reality experiences.

In SamwiseOS, the browser isn't just a host; it's the motherboard.

---

## Current Status

This project is a work-in-progress, but it has come a long way! We are in the middle of a migration to make the entire operating system fully self-contained and capable of running offline.

-   **Python Kernel:** The core of the OS is a robust Python kernel that runs entirely in the browser thanks to the magic of **Pyodide**.
-   **Offline First:** We've successfully moved from a CDN-based Pyodide to a locally hosted distribution. The OS can now run without an internet connection! The final steps of this migration are still in progress.
-   **Virtual File System:** A fully functional virtual file system (VFS) is implemented, allowing for file and directory manipulation.
-   **Local Persistence:** The file system state is saved to the browser's local storage, so your work persists between sessions.
-   **Rich Command Set:** We have a growing list of standard POSIX-like commands (e.g., `ls`, `cat`, `grep`, `mkdir`) and custom AI-powered commands.
-   **GUI Applications:** It's not just a terminal! SamwiseOS supports GUI applications like a text editor (`edit`), file explorer (`explore`), and even a paint program (`paint`).

## Features

* **AI-Powered Shell:** Interact with the OS using natural language.
* **Python Backend, JS Frontend:** A powerful combination running entirely in the browser.
* **Self-Contained:** All dependencies, including the Python runtime and packages, are bundled with the app.
* **Persistent File System:** Your files and directory structure are saved locally.
* **Extensible Commands:** Easily add new commands in Python or JavaScript.
* **GUI Apps:** Run graphical applications within the OS environment.
* **User and Group Management:** Basic multi-user support with `sudo` capabilities.

## How to Run

1.  **Clone the repository.**
2.  **Download Pyodide:**
    * Go to the [Pyodide releases page](https://github.com/pyodide/pyodide/releases).
    * Download the latest full release file.
    * Extract the contents and copy them into the `dist/pyodide/` directory. (Follow the instructions in `dist/pyodide/README.md`).
3.  **Run a local web server** in the project's root directory. A simple way to do this is with Python:
    ```bash
    python -m http.server
    ```
4.  Open your browser and navigate to the server's address (e.g., `http://localhost:8000`).