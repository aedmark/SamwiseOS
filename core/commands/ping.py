# gem/core/commands/ping.py

import time
import urllib.request
import random

def define_flags():
    """Declares the flags that the ping command accepts."""
    return [
        {'name': 'count', 'short': 'c', 'long': 'count', 'takes_value': True},
    ]

def run(args, flags, user_context, **kwargs):
    if not args:
        return {"success": False, "error": "ping: usage error: Destination address required"}

    host = args[0]
    count = 4
    if flags.get('count'):
        try:
            count = int(flags['count'])
            if count <= 0:
                return {"success": False, "error": "ping: bad number of packets to transmit."}
        except ValueError:
            return {"success": False, "error": f"ping: invalid count: '{flags['count']}'"}

    url_to_ping = 'http://' + host if not host.startswith(('http://', 'https://')) else host

    output = [f"PING {host} ({url_to_ping}): 56 data bytes"]
    rtt_times, packets_sent, packets_received = [], 0, 0

    for i in range(count):
        packets_sent += 1
        try:
            req = urllib.request.Request(url_to_ping, method='HEAD', headers={'User-Agent': 'SamwiseOS/1.0'})
            start_time = time.time()
            with urllib.request.urlopen(req, timeout=5) as response:
                end_time = time.time()
                rtt = (end_time - start_time) * 1000
                rtt_times.append(rtt)
                packets_received += 1
                ttl = random.randint(50, 64)
                output.append(f"64 bytes from {host}: icmp_seq={i+1} ttl={ttl} time={rtt:.3f} ms")
        except Exception as e:
            output.append(f"Request timeout for icmp_seq {i+1}")
        if i < count - 1:
            time.sleep(1)

    packet_loss = ((packets_sent - packets_received) / packets_sent) * 100 if packets_sent > 0 else 0
    stats = f"\\n--- {host} ping statistics ---\\n"
    stats += f"{packets_sent} packets transmitted, {packets_received} received, {packet_loss:.1f}% packet loss"
    if rtt_times:
        min_rtt, avg_rtt, max_rtt = min(rtt_times), sum(rtt_times) / len(rtt_times), max(rtt_times)
        stats += f"\\nround-trip min/avg/max = {min_rtt:.3f}/{avg_rtt:.3f}/{max_rtt:.3f} ms"
    output.append(stats)

    # Ping should "succeed" even if packets are lost, unless the host is unresolvable at the start.
    return "\\n".join(output)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    ping - send HTTP requests to check network host connectivity

SYNOPSIS
    ping [-c count] destination

DESCRIPTION
    ping sends HTTP requests to the destination to check for connectivity
    and measure round-trip time. This version uses HTTP/S instead of ICMP.

    -c, --count
          Stop after sending count requests.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the ping command."""
    return "Usage: ping [-c count] destination"