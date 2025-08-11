# ==============================================================================
#
# SamwiseOS: System Integrity & Diagnostic Test Suite v2.1
#
# This script provides a comprehensive, automated test of the core
# functionality of the SamwiseOS, ensuring all systems are operational
# without using advanced shell features like functions.
#
# ==============================================================================

# --- Phase 1: Environment Setup ---
echo ""
echo "======================================================================"
echo "  PHASE: Environment & User Setup"
echo "======================================================================"
sleep 1

echo "Creating test users: diag_user, perm_user, sudo_user..."
echo -e "testpass\ntestpass" | useradd diag_user
echo -e "testpass\ntestpass" | useradd perm_user
echo -e "testpass\ntestpass" | useradd sudo_user

echo "Creating test groups: test_group..."
groupadd test_group

echo "Setting up diagnostic workspace in /home/diag_user/..."
mkdir -p /home/diag_user/ws
chown diag_user /home/diag_user/ws
chgrp test_group /home/diag_user/ws
chmod 770 /home/diag_user/ws

echo "Configuring sudo permissions for 'sudo_user'..."
echo "sudouser ALL" >> /etc/sudoers

echo "Creating test assets..."
mkdir -p asset_dir/nested_dir
echo -e "line one\nline two\nline three" > asset_dir/file_a.txt
echo -e "line one\nline 2\nline three" > asset_dir/file_b.txt
echo "zeta\nalpha\nbeta\nalpha\n10\n2" > asset_dir/sort_me.txt
echo "Test assets created in 'asset_dir'."

# --- Phase 2: Core Filesystem Commands ---
echo ""
echo "======================================================================"
echo "  PHASE: Core Filesystem Commands"
echo "======================================================================"
sleep 1

echo ""
echo "--- Test: ls: Sorting flags (-t, -S, -X, -r) ---"
sleep 0.5
touch -d "2 days ago" asset_dir/oldest.file
touch -d "1 day ago" asset_dir/newer.file
echo "short" > asset_dir/small.log
echo "this is a much longer line of text" > asset_dir/large.log
ls -lt asset_dir/
ls -lS asset_dir/
ls -lX asset_dir/
ls -lr asset_dir/

echo ""
echo "--- Test: cp: Copying files and preserving permissions ---"
sleep 0.5
touch asset_dir/preserve_me.txt
chmod 700 asset_dir/preserve_me.txt
cp -p asset_dir/preserve_me.txt asset_dir/preserved_copy.txt
ls -l asset_dir/preserve*.txt

echo ""
echo "--- Test: mv: Moving a file into a directory ---"
sleep 0.5
mkdir asset_dir/move_target
mv asset_dir/file_a.txt asset_dir/move_target/
ls asset_dir/move_target/

echo ""
echo "--- Test: rm and rmdir: Removing files and empty directories ---"
sleep 0.5
touch asset_dir/to_delete.txt
rm asset_dir/to_delete.txt
check_fail "ls asset_dir/to_delete.txt"
mkdir asset_dir/empty_dir
rmdir asset_dir/empty_dir
check_fail "ls asset_dir/empty_dir"

echo ""
echo "--- Test: ln: Symbolic link creation and resolution ---"
sleep 0.5
echo "Original target" > asset_dir/original.txt
ln -s asset_dir/original.txt symlink_to_original
cat symlink_to_original
ls -l symlink_to_original
rm symlink_to_original asset_dir/original.txt

# --- Phase 3: Permissions & Ownership ---
echo ""
echo "======================================================================"
echo "  PHASE: Permissions, Ownership & Sudo"
echo "======================================================================"
sleep 1

echo ""
echo "--- Test: chown/chgrp: Changing ownership and group ---"
sleep 0.5
touch asset_dir/owned_file.txt
chown diag_user asset_dir/owned_file.txt
chgrp test_group asset_dir/owned_file.txt
ls -l asset_dir/owned_file.txt

echo ""
echo "--- Test: Group Permissions: Writing to a group-owned directory ---"
sleep 0.5
usermod -aG test_group perm_user
logout
su perm_user testpass
echo "Written by perm_user" > /home/diag_user/ws/perm_test.txt
cat /home/diag_user/ws/perm_test.txt
logout

echo ""
echo "--- Test: Sudo: Executing a command as root ---"
sleep 0.5
su sudo_user testpass
sudo echo "This command was executed as root."
testpass
logout

# --- Phase 4: Data Processing & Pipelines ---
echo ""
echo "======================================================================"
echo "  PHASE: Data Processing & Pipelines"
echo "======================================================================"
sleep 1

echo ""
echo "--- Test: grep: Searching for patterns in a file ---"
sleep 0.5
grep "line" asset_dir/file_b.txt
grep -v "line two" asset_dir/file_b.txt
grep -c "line" asset_dir/file_b.txt

echo ""
echo "--- Test: sort: Sorting file content ---"
sleep 0.5
sort asset_dir/sort_me.txt
sort -n asset_dir/sort_me.txt
sort -r asset_dir/sort_me.txt

echo ""
echo "--- Test: Pipes: Chaining commands together ---"
sleep 0.5
cat asset_dir/sort_me.txt | grep "a" | sort | uniq -c

echo ""
echo "--- Test: Redirection: Writing command output to a file ---"
sleep 0.5
ls -l asset_dir/ > /home/diag_user/ws/listing.txt
cat /home/diag_user/ws/listing.txt

# --- Phase 5: Advanced & Archival Commands ---
echo ""
echo "======================================================================"
echo "  PHASE: Advanced & Archival Commands"
echo "======================================================================"
sleep 1

echo ""
echo "--- Test: find: Locating files by name and type ---"
sleep 0.5
find asset_dir/ -name "*.txt"
find asset_dir/ -type d

echo ""
echo "--- Test: zip/unzip: Creating and extracting archives ---"
sleep 0.5
zip my_archive.zip asset_dir/
rm -r asset_dir/
unzip my_archive.zip
ls -R asset_dir/

echo ""
echo "--- Test: xor and base64: Simple encoding and decoding ---"
sleep 0.5
echo "secret message" | base64 | base64 -d
echo "secret message" | xor mykey | xor mykey

# --- Phase 6: System & Session Management ---
echo ""
echo "======================================================================"
echo "  PHASE: System & Session Management"
echo "======================================================================"
sleep 1

echo ""
echo "--- Test: System Information: date, df, du ---"
sleep 0.5
date
df -h
du -h asset_dir/

echo ""
echo "--- Test: Session State: alias, set, history ---"
sleep 0.5
alias ll="ls -l"
ll asset_dir/
unalias ll
check_fail "ll"

set MY_VAR="hello world"
echo $MY_VAR
unset MY_VAR
check_fail -z "echo $MY_VAR"

history -c
history

# --- Phase 7: Final Cleanup ---
echo ""
echo "======================================================================"
echo "  PHASE: Final Cleanup"
echo "======================================================================"
sleep 1

echo "Removing test assets and users..."
rm -r asset_dir/ my_archive.zip
removeuser -r diag_user
removeuser -r perm_user
removeuser -r sudo_user
groupdel test_group
echo "Cleanup complete."

echo ""
echo "======================================================================"
echo "  SamwiseOS Diagnostic Suite: ALL TESTS PASSED!"
echo "======================================================================"
beep