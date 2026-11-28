"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@/lib/api";
import type { AttemptSummary, ExamFull } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ErrorNote, PageHeader, PageSkeleton } from "@/components/app/kit";
import { ExamBuilder } from "@/components/app/exam-builder";

export default function EditExamPage() {
  const { examId } = useParams<{ examId: string }>();
  const exam = useQuery<ExamFull>(`/api/exams/${examId}`);
  const attempts = useQuery<{ attempts: AttemptSummary[] }>(`/api/exams/${examId}/attempts`);

  if (exam.error) return <ErrorNote message={exam.error} onRetry={exam.reload} />;
  if (!exam.data || attempts.loading) return <PageSkeleton />;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
        <Link href={`/proctor/exams/${examId}`}>
          <ArrowLeft /> {exam.data.title}
        </Link>
      </Button>
      <PageHeader
        eyebrow="[ 02 ]  Edit exam"
        title={
          <>
            Editing <b>{exam.data.title}</b>
          </>
        }
      />
      <ExamBuilder initial={exam.data} locked={(attempts.data?.attempts.length ?? 0) > 0} />
    </>
  );
}
