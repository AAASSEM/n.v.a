import asyncio
from app.db.session import async_session
from app.models.user import User
from sqlalchemy.future import select

async def main():
    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == 'aaa136@gmail.com'))
        user = result.scalars().first()
        if user:
            user.is_developer = True
            await db.commit()
            print('Successfully set aaa136@gmail.com as a developer.')
        else:
            print('User not found.')

if __name__ == '__main__':
    asyncio.run(main())
