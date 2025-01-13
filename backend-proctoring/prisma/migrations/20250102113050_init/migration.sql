/*
  Warnings:

  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `_ExamToUser` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `organisationId` to the `Exam` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organisationId` to the `ProctoringSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organisationId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PROCTOR', 'STUDENT');

-- DropForeignKey
ALTER TABLE "_ExamToUser" DROP CONSTRAINT "_ExamToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_ExamToUser" DROP CONSTRAINT "_ExamToUser_B_fkey";

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "organisationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ProctoringSession" ADD COLUMN     "organisationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "organisationId" TEXT NOT NULL,
DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'STUDENT';

-- DropTable
DROP TABLE "_ExamToUser";

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserExams" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UserExams_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_name_key" ON "Organisation"("name");

-- CreateIndex
CREATE INDEX "_UserExams_B_index" ON "_UserExams"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProctoringSession" ADD CONSTRAINT "ProctoringSession_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserExams" ADD CONSTRAINT "_UserExams_A_fkey" FOREIGN KEY ("A") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserExams" ADD CONSTRAINT "_UserExams_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
