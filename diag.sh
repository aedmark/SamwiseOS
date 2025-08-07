#!/bin/sh
#
# OopisOS Hybrid Kernel Diagnostic Script
#

echo "===== [ Phase 1: Basic Python Command Verification ] ====="
echo "--> Testing date, pwd, whoami..."
date
pwd
whoami
echo "\n--> Testing ls and cat on a system file..."
ls /etc/sudoers
cat /etc/sudoers

# ---

echo "\n\n===== [ Phase 2: Filesystem Mutation Tests ] ====="
echo "--> Creating temporary test directory at /tmp/diag..."
mkdir /tmp/diag
cd /tmp/diag

echo "\n--> Creating test files with touch and echo..."
touch file1.txt
echo "hello world" > file2.txt
echo "line 1\nline 2\nline 3" > file3.txt
ls

echo "\n--> Testing copy, rename, and symbolic links..."
cp file2.txt file2-copy.txt
rename file1.txt empty.txt
ln -s file3.txt link-to-file3.txt
ls -l

echo "\n--> Testing permission and ownership changes..."
chmod 777 empty.txt
chown root file2-copy.txt
chgrp root link-to-file3.txt
ls -l

# ---

echo "\n\n===== [ Phase 3: Piping and Redirection Tests ] ====="
echo "--> Testing Python-to-Python piping (ls | grep | wc)..."
ls /core/commands | grep .py | wc -l

echo "\n--> Testing output redirection (>) and input redirection (<)..."
ls /core/commands > file_list.txt
echo "File list saved. Now counting lines with 'wc < file_list.txt':"
wc -l < file_list.txt

echo "\n--> Testing append redirection (>>)..."
echo "---" >> file_list.txt
tail -n 2 file_list.txt

# ---

echo "\n\n===== [ Phase 4: Advanced & Effect Command Tests ] ====="
echo "--> Testing xargs (ls | head | xargs)..."
ls /core/commands/*.py | head -n 3 | xargs grep "def run"

echo "\n--> Testing zip/unzip..."
zip test.zip file2.txt file3.txt
rm file2.txt file3.txt
unzip test.zip .
echo "Unzipped files:"
ls file2.txt file3.txt

echo "\n--> Testing partial JS/Python command (history -c)..."
echo "History before clear:"
history | tail -n 2
history -c
echo "History after clear (should be empty):"
history

echo "\n--> Testing effect command (beep)..."
echo "You should hear a beep now."
beep

# ---

echo "\n\n===== [ Phase 5: Cleanup ] ====="
echo "--> Removing temporary directory /tmp/diag..."
cd /
rm -r /tmp/diag
echo "--> Diagnostic complete."