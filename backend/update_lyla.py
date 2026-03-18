import sqlite3

conn = sqlite3.connect('esg_portal.db')
cursor = conn.cursor()

# Get the user ID
cursor.execute("SELECT id FROM users WHERE email = 'aaa136@gmail.com'")
user_record = cursor.fetchone()

if user_record:
    user_id = user_record[0]
    cursor.execute("UPDATE user_profiles SET role = 'admin' WHERE user_id = ?", (user_id,))
    conn.commit()
    print(f"Updated user {user_id} (aaa136@gmail.com) role to admin!")
else:
    print("User not found.")

conn.close()
