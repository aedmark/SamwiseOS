echo "--- Test: Logical OR (||) and interactive flags ---"
check_fail "cat nonexistent_file.txt" || echo "Logical OR successful: cat failed as expected."
echo "YES" > yes.txt
echo "n" > no.txt
touch interactive_test.txt
rm -i interactive_test.txt < yes.txt
check_fail "ls interactive_test.txt"
touch another_file.txt
delay 200
echo "Interactive Copy Test"
mkdir overwrite_dir
cp -i another_file.txt overwrite_dir/another_file.txt < yes.txt
delay 200
cat ./overwrite_dir/another_file.txt
delay 200
echo "Did it work?"
delay 200
rm -r no.txt yes.txt another_file.txt overwrite_dir
echo "Interactive flag and logical OR tests complete."
delay 400
echo "---------------------------------------------------------------------"