-- Optional sign-in username per user (stored lowercase; email remains the primary identifier).
ALTER TABLE "User" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
