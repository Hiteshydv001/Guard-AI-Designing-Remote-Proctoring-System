import { emit, emitWarning } from "process";
import { z } from "zod";

export const UserRole = z.enum(["ADMIN", "PROCTOR", "STUDENT"]);

export const OrganisationSchema = z.object({
    name: z.string().min(1),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

export const UserSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    salt: z.string().min(1),
    role: UserRole.default("STUDENT"),
    organisationId: z.string(),
    organisation: z.any().optional(),
    exams: z.array(z.any()).optional(),
    sessions: z.array(z.any()).optional(),
});

export const ExamSchema = z.object({
    id: z.string(),
    title: z.string().min(1),
    duration: z.number().int().positive(),
    organisationId: z.string(),
    organisation: z.any().optional(),
    users: z.array(z.any()).optional(),
    sessions: z.array(z.any()).optional(),
});

export const ProctoringSessionSchema = z.object({
    id: z.string(),
    status: z.string().min(1),
    startTime: z.date(),
    endTime: z.date().nullable(),
    examId: z.string(),
    userId: z.string(),
    organisationId: z.string(),
      user: z.any().optional(),
    exam: z.any().optional(),
    organisation: z.any().optional(),
});


export const UpdateUserScheme = z.object({
    id: z.string(),
    name: z.string().min(1),
    email: z.string().email(),
});

export const StartSessionSchema = z.object({
    examId: z.string(),
    userId: z.string(),
    organisationId: z.string(),
  });



export type userRole = z.infer<typeof UserRole>;
export type Organisation = z.infer<typeof OrganisationSchema>;
export type User = z.infer<typeof UserSchema>;
export type Exam = z.infer<typeof ExamSchema>;
export type ProctoringSession = z.infer<typeof ProctoringSessionSchema>;
export type UpdateUser = z.infer<typeof UpdateUserScheme>;
export type StartSession = z.infer<typeof StartSessionSchema>;