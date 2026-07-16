import argparse
import subprocess
import sys

def main():
    parser = argparse.ArgumentParser(description="Generate load for Realtime Log Analytics Platform")
    parser.add_argument("--profile", choices=["light", "medium", "heavy"], help="Pre-defined load profile")
    parser.add_argument("--duration", type=int, help="Duration in seconds (for custom profile)", default=60)
    parser.add_argument("--rps", type=int, help="Target Requests Per Second (RPS) (for custom profile)")
    parser.add_argument("--concurrency", type=int, help="Number of concurrent VUs (for custom profile)")
    
    args = parser.parse_args()
    
    # Defaults
    vus = 10
    duration = "60s"
    sleep_time = 1.0
    
    if args.profile == "light":
        vus = 5
        duration = "30s"
        sleep_time = 1.0
        print("Profile: Light (5 VUs, ~5 RPS, 30s)")
    elif args.profile == "medium":
        vus = 20
        duration = "2m"
        sleep_time = 0.5
        print("Profile: Medium (20 VUs, ~40 RPS, 2m)")
    elif args.profile == "heavy":
        vus = 100
        duration = "3m"
        sleep_time = 0.1
        print("Profile: Heavy (100 VUs, ~1000 RPS, 3m)")
    else:
        if args.concurrency:
            vus = args.concurrency
        if args.duration:
            duration = f"{args.duration}s"
        if args.rps and args.concurrency:
            sleep_time = args.concurrency / args.rps
        elif args.rps:
            vus = max(1, args.rps // 10)
            sleep_time = vus / args.rps
        print(f"Profile: Custom ({vus} VUs, {duration})")

    script = f"""
import http from 'k6/http';
import {{ sleep }} from 'k6';

export const options = {{
  vus: {vus},
  duration: '{duration}',
}};

const BASE_URL = 'http://host.docker.internal:8080';

export default function () {{
  const rand = Math.random();
  const uuid = 'user-' + __VU + '-' + __ITER;
  
  if (rand < 0.5) {{
    http.post(`${{BASE_URL}}/users/profile`, null, {{ headers: {{ 'Content-Type': 'application/json' }} }});
  }} else if (rand < 0.8) {{
    http.post(`${{BASE_URL}}/users/checkout`, JSON.stringify({{ user_id: uuid, amount: 1200 }}), {{ headers: {{ 'Content-Type': 'application/json' }} }});
  }} else {{
    http.post(`${{BASE_URL}}/orders`, JSON.stringify({{ order_id: "order-" + uuid, amount: 1200 }}), {{ headers: {{ 'Content-Type': 'application/json' }} }});
  }}

  sleep({sleep_time});
}}
"""
    
    cmd = ["docker", "run", "--rm", "-i", "grafana/k6", "run", "-"]
    print(f"Running k6 via Docker...")
    
    try:
        process = subprocess.run(
            cmd, 
            input=script.encode('utf-8'),
            stdout=sys.stdout,
            stderr=sys.stderr
        )
        sys.exit(process.returncode)
    except KeyboardInterrupt:
        print("\nLoad generation stopped.")
        sys.exit(0)

if __name__ == "__main__":
    main()
