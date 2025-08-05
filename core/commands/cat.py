from filesystem import fs_manager

def run(args, flags, user_context):
    """
    Concatenates and displays the content of files.
    """
    if not args:
        # In the future, this would read from stdin. For now, it's a no-op.
        return ""

    output_parts = []
    line_counter = 1

    for path_arg in args:
        full_path = fs_manager.get_absolute_path(path_arg)
        node = fs_manager.get_node(full_path)

        if not node:
            raise FileNotFoundError(f"cat: {path_arg}: No such file or directory")

        if node.get('type') == 'directory':
            raise IsADirectoryError(f"cat: {path_arg}: Is a directory")

        content = node.get('content', '')

        if "-n" in flags:
            lines = content.split('\\n')
            for line in lines:
                output_parts.append(f"     {str(line_counter).rjust(5)}  {line}")
                line_counter += 1
        else:
            output_parts.append(content)

    return "\\n".join(output_parts)