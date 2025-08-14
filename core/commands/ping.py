# gem/core/commands/ping.py

import time
import urllib.request
import random
import asyncio
from pyodide.http import pyfetch
import os
from urllib.parse import urlparse

def define_flags():
    """Declares the flags that the ping command accepts."""
    return [
        {'name': 'count', 'short': 'c', 'long': 'count', 'takes_value': True},
    ]

async def run(args, flags, user_context, **kwargs):
    if not args:
        return {"success": False, "error": "ping: usage error: Destination address required"}

    host_or_url = args[0]

    # Create a clean URL for pyfetch
    url_to_ping = host_or_url
    if not url_to_ping.startswith(('http://', 'https://')):
        url_to_ping = 'https://' + url_to_ping  # Default to HTTPS for better compatibility

    # Extract the hostname for display and error messages
    try:
        hostname = urlparse(url_to_ping).hostname
        if not hostname:
            raise ValueError
    except (ValueError, AttributeError):
        hostname = host_or_url.split('/')[0]

    count = 4
    if flags.get('count'):
        try:
            count = int(flags['count'])
            if count <= 0:
                return {"success": False, "error": "ping: bad number of packets to transmit."}
        except ValueError:
            return {"success": False, "error": f"ping: invalid count: '{flags['count']}'"}

    output = [f"PING {hostname}: 56 data bytes"]
    rtt_times, packets_sent, packets_received = [], 0, 0

    for i in range(count):
        packets_sent += 1
        try:
            start_time = time.time()
            # Add a 5-second timeout to prevent hangs
            response = await asyncio.wait_for(
                pyfetch(url_to_ping, method='HEAD', headers={'User-Agent': 'SamwiseOS/1.0'}),
                timeout=5.0
            )
            end_time = time.time()

            if not response.ok:
                output.append(f"Request failed for icmp_seq {i+1}: Status {response.status}")
            else:
                rtt = (end_time - start_time) * 1000
                rtt_times.append(rtt)
                packets_received += 1
                ttl = random.randint(50, 64) # This is illustrative, as browser doesn't expose TTL
                output.append(f"64 bytes from {hostname}: icmp_seq={i+1} ttl={ttl} time={rtt:.3f} ms")

        except asyncio.TimeoutError:
            output.append(f"Request to {hostname} timed out for icmp_seq {i+1}")
        except Exception as e:
            # Catch the specific browser security error!
            error_text = str(e)
            if 'Failed to fetch' in error_text or 'CORS' in error_text:
                error_message = f"ping: Request to {hostname} was blocked by the browser's security policy (CORS). This is a web limitation, not a network error. You can only ping servers that explicitly allow it."
                return {"success": False, "error": error_message}

            # For other potential errors, provide a more general but accurate message.
            error_message = f"ping: cannot resolve {hostname}: Unknown host or network error."
            return {"success": False, "error": error_message}

        if i < count - 1:
            await asyncio.sleep(1)

    packet_loss = ((packets_sent - packets_received) / packets_sent) * 100 if packets_sent > 0 else 0
    stats = f"\n--- {hostname} ping statistics ---\n"
    stats += f"{packets_sent} packets transmitted, {packets_received} received, {packet_loss:.1f}% packet loss"
    if rtt_times:
        min_rtt, avg_rtt, max_rtt = min(rtt_times), sum(rtt_times) / len(rtt_times), max(rtt_times)
        stats += f"\nround-trip min/avg/max = {min_rtt:.3f}/{avg_rtt:.3f}/{max_rtt:.3f} ms"
    output.append(stats)

    return "\n".join(output)

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