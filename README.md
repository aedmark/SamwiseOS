# SamwiseOS: The Little OS That Could

### An AI-centric operating system built with relentless optimism and a whole lot of Python.

This project is a bold exploration into creating a unique, web-based operating system where the primary interface is a generative AI. After a successful and system-wide migration, our core logic now runs on a robust Python kernel, making the OS more powerful and extensible than ever. It's a testament to what we can achieve with a can-do attitude, a lot of heart, and a little help from our friends (even the digital ones!).

## What is this?

SamwiseOS is a web-based operating system designed from the ground up to be **AI-first**. Instead of a traditional GUI or a simple command line, you interact with the system through a conversation with an AI. The AI can understand complex commands, create and manage files, and even write and execute code on your behalf. The entire OS is a single-page application that runs right in your browser.

## The Hybrid Kernel: Our Superpower

SamwiseOS is a new genre of operating system: a **Hybrid Web OS**.

Our architecture is a deliberate fusion of two powerful environments. We combine a robust, sandboxed **Python kernel** running in WebAssembly with a nimble **JavaScript frontend** that has direct access to browser APIs. This isn't a compromise; it's our greatest strength.

-   **The Python Kernel:** Handles the heavy lifting. All core logic for the virtual file system, user and group management, process control, and complex command execution lives here. It's secure, stateful, and the single source of truth for the OS.

-   **The JavaScript Stage Manager:** Interacts with the world outside the sandbox. It handles everything that makes the OS feel alive and connected, including the terminal UI, sound synthesis, peer-to-peer networking, and graphical applications.

### How It Works: The `effect` Contract

The magic happens through a simple, powerful contract. When a command needs to interact with the browser, the Python kernel doesn't perform the action itself. Instead, it validates the request and returns a JSON object called an `effect`. For example, when you run `play C4 4n`, the Python kernel returns `{"effect": "play_sound", "notes": ["C4"], "duration": "4n"}`, and the JavaScript `CommandExecutor` plays the note. This keeps our core logic clean and secure within Python while leveraging the browser's full capabilities.

---

## Features

-   **Brand New Onboarding!** A friendly, guided setup process to create your user account and secure the `root` password.
-   **AI-Powered Shell:** Interact with the OS using natural language. The `gemini` command can use system tools to answer questions, and commands like `forge` and `storyboard` can generate and analyze code for you.
-   **Python Backend, JS Frontend:** A powerful and unique combination running entirely in your browser, leveraging Pyodide for the Python runtime.
-   **Self-Contained & Offline-First:** No internet connection required after the initial setup!
-   **Persistent File System:** Your files are saved locally to your browser's IndexedDB.
-   **Rich Command Set:** A huge list of POSIX-like commands and custom AI-powered tools.
-   **GUI Applications:** Supports graphical applications like a text editor (`edit`), a file explorer, a paint program (`paint`), a BASIC interpreter (`basic`), a process viewer (`top`), and more!
-   **User and Group Management:** A robust, secure system for managing users and groups, complete with `sudo` capabilities and a virtual `/etc/sudoers` file.
-   **Job Control:** Run long-running tasks in the background (`&`), view them (`ps`, `jobs`), and manage them (`kill`, `fg`, `bg`).

## The Road Ahead: Our Next Five Parks

A vision without a plan is just a dream. Here is our official roadmap—a commitment to our users and a guide for our development.

### Milestone 1: The AI Town Manager 🧠

The AI is the heart of SamwiseOS. Our next priority is to make it a true partner in productivity.

-   **Long-Term Memory:** Enable the AI to remember context across multiple sessions.
-   **Advanced Tool Use:** Greatly expand the number of `effects` the AI can use, allowing it to perform more complex, multi-step tasks on its own.
-   **Self-Correction:** Implement logic for the AI to analyze the output of commands it runs, recognize errors, and attempt to correct its own course of action.

### Milestone 2: The Creative Suite 🎨

An OS needs powerful, intuitive applications. We will expand our suite of GUI programs to empower human creativity.

-   **`edit` v2.0:** Add syntax highlighting and collaborative multi-user editing.
-   **`calc`:** A new grid-based spreadsheet application for calculations and data organization.
-   **`slides`:** A new application for creating and presenting simple slideshows.

### Milestone 3: The Social Fabric 🤝

Leverage the browser's native networking capabilities to connect users in new ways.

-   **Peer-to-Peer Filesystem:** Using **WebRTC**, allow users to securely and directly share files or entire directories with each other, right from the terminal.
-   **`talk` command:** A simple, end-to-end encrypted chat client for real-time communication between SamwiseOS users.

### Milestone 4: The Hardware Bridge 🔌

The browser is our motherboard. It's time to plug things into it.

-   **`joypad` API:** Integrate the **WebUSB/WebBluetooth** APIs to allow games and applications to respond to physical game controllers.
-   **`g-paint`:** Create a new version of our `paint` application that uses **WebGPU** for hardware-accelerated graphics and effects.
-   **`device-link`:** A command and API for interacting with microcontrollers and other USB-serial devices.

### Milestone 5: The Town Hall 🏛️

Focus on community, polish, and long-term sustainability.

-   **Theming Engine:** Allow users to customize the look and feel of the OS with custom colors, fonts, and sound packs.
-   **Developer SDK:** Create clear, robust documentation and tooling to help third-party developers build and share their own commands and applications for SamwiseOS.
-   **Accessibility Overhaul:** A top-to-bottom review to ensure the OS is usable and enjoyable for everyone.

---

## How to Run

1.  **Clone the repository.**
2.  **Download Pyodide** into the `dist/pyodide/` directory by following the instructions on their releases page and in the local `README.md`.
3.  **Run a local web server** in the project's root directory (e.g., `python -m http.server`).
4.  Open your browser and navigate to the server's address (e.g., `http://localhost:8000`).

---

## System Reference

### Available Commands

| Command | Description |
| :--- | :--- |
| **adventure** | Starts an interactive text adventure game. |
| **agenda** | Schedules commands to run at specified times. |
| **alias** | Define or display command aliases. |
| **awk** | Pattern scanning and processing language. |
| **backup** | Creates a secure backup of the system state. |
| **base64** | Base64 encode or decode data. |
| **basic** | The Samwise BASIC Integrated Development Environment. |
| **bc** | An arbitrary precision calculator language. |
| **beep** | Play a short system sound. |
| **bg** | Resume a job in the background. |
| **binder** | Create and manage collections of files. |
| **bulletin** | Manages the system-wide bulletin board. |
| **cat** | Concatenate and print files. |
| **cd** | Change the current directory. |
| **check_fail**| A testing utility to check if a command fails. |
| **chgrp** | Change group ownership of files. |
| **chidi** | AI-powered document and code analyst. |
| **chmod** | Change file mode bits (permissions). |
| **chown** | Change file owner. |
| **cksum** | Checksum and count the bytes in a file. |
| **clear** | Clear the terminal screen. |
| **clearfs** | Clears all files from the user's home directory. |
| **comm** | Compare two sorted files line by line. |
| **committee** | Creates a collaborative project space. |
| **cp** | Copy files and directories. |
| **csplit** | Split a file into sections. |
| **cut** | Remove sections from each line of files. |
| **date** | Print the system date and time. |
| **delay** | Pause script execution for a specified time. |
| **df** | Report file system disk space usage. |
| **diff** | Compare files line by line. |
| **du** | Estimate file space usage. |
| **echo** | Display a line of text. |
| **edit** | A powerful text and code editor. |
| **export** | Download a file from SamwiseOS to your local machine. |
| **expr** | Evaluate expressions. |
| **fg** | Resume a job in the foreground. |
| **find** | Search for files in a directory hierarchy. |
| **forge** | AI-powered scaffolding and boilerplate generation. |
| **fsck** | Check and repair a file system. |
| **gemini** | Engage in a conversation with an AI model. |
| **grep** | Print lines that match patterns. |
| **groupadd** | Create a new group. |
| **groupdel** | Delete a group. |
| **groups** | Print the groups a user is in. |
| **head** | Output the first part of files. |
| **help** | Display information about available commands. |
| **history** | Display command history. |
| **jobs** | Display status of jobs in the current session. |
| **kill** | Send a signal to a process or job. |
| **less** | Opposite of more; a file perusal filter. |
| **listusers** | Lists all registered users on the system. |
| **ln** | Make links between files. |
| **log** | A personal, timestamped journal and log application. |
| **login** | Begin a session on the system. |
| **logout** | Terminate a login session. |
| **ls** | List directory contents. |
| **man** | Format and display the on-line manual pages. |
| **mkdir** | Make directories. |
| **more** | File perusal filter for CRT viewing. |
| **mv** | Move or rename files. |
| **nc** | Netcat utility for network communication. |
| **netstat** | Shows network status and connections. |
| **nl** | Number lines of files. |
| **ocrypt** | Securely encrypt and decrypt files. |
| **paint** | Opens the character-based art editor. |
| **passwd** | Change user password. |
| **patch** | Apply a diff file to an original. |
| **planner** | Manages shared project to-do lists. |
| **play** | Plays a musical note or chord. |
| **post_message**| Sends a message to a background job. |
| **printf** | Format and print data. |
| **printscreen**| Captures the screen content as an image or text. |
| **ps** | Report a snapshot of the current processes. |
| **pwd** | Print name of current/working directory. |
| **read_messages**| Reads all messages from a job's message queue. |
| **reboot** | Reboot the system. |
| **remix** | Synthesizes a new article from two source documents using AI. |
| **removeuser**| Remove a user from the system. |
| **rename** | Rename a file. |
| **reset** | Reset the filesystem to its initial state. |
| **restore** | Restores the system state from a backup file. |
| **rm** | Remove files or directories. |
| **rmdir** | Remove empty directories. |
| **run** | Execute commands from a file. |
| **sed** | Stream editor for filtering and transforming text. |
| **set** | Set or display shell variables. |
| **shuf** | Generate random permutations. |
| **sort** | Sort lines of text files. |
| **storyboard**| Analyzes and creates a narrative summary of files. |
| **su** | Substitute user identity. |
| **sudo** | Execute a command as another user. |
| **sync** | Synchronize data on disk with memory. |
| **tail** | Output the last part of files. |
| **top** | Displays a real-time view of running processes. |
| **touch** | Change file timestamps. |
| **tr** | Translate, squeeze, and/or delete characters. |
| **tree** | List contents of directories in a tree-like format. |
| **unalias** | Remove alias definitions. |
| **uniq** | Report or omit repeated lines. |
| **unset** | Unset shell variables. |
| **unzip** | List, test and extract compressed files in a ZIP archive. |
| **upload** | Upload files from your local machine to SamwiseOS. |
| **uptime** | Tell how long the system has been running. |
| **useradd** | Create a new user. |
| **usermod** | Modify a user account. |
| **visudo** | Edit the sudoers file safely. |
| **wc** | Print newline, word, and byte counts for each file. |
| **who** | Show who is logged on. |
| **whoami** | Print effective user ID. |
| **xargs** | Build and execute command lines from standard input. |
| **xor** | Perform XOR encryption/decryption. |
| **zip** | Package and compress (archive) files. |

### Graphical Applications

| Command | Application Name | Description |
| :--- | :--- | :--- |
| **edit** | SamwiseOS Editor | A full-featured text and code editor with Markdown/HTML preview. |
| **paint** | SamwiseOS Paint | A character-based art and ASCII editor. |
| **chidi** | Chidi Analyst | An AI-powered tool to summarize, study, and ask questions about your documents. |
| **gemini** | Gemini Chat | An interactive, graphical chat session with the system's AI. |
| **top** | Process Viewer | A real-time display of all running background jobs. |
| **log** | Captain's Log | A personal, timestamped journal application. |
| **basic** | Samwise BASIC | An integrated development environment for the BASIC programming language. |
| **adventure** | Text Adventure | A classic interactive fiction game engine. |

This is more than just an OS; it's a project built with passion, dedication, and a belief in making things better. Thank you for being a part of it. Now, let's get to work!