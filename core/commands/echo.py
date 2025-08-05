def run(args, flags, user_context):
    """
    Writes arguments to the standard output.
    """
    output = " ".join(args)
    suppress_newline = False

    if "-e" in flags:
        c_index = output.find("\\c")
        if c_index != -1:
            output = output[:c_index]
            suppress_newline = True

        output = output.replace("\\n", "\n").replace("\\t", "\t").replace("\\\\", "\\")

    return {"output": output, "suppress_newline": suppress_newline}