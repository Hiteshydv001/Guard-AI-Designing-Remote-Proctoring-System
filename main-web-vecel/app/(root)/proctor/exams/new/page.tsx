"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/kit";
import { ExamBuilder } from "@/components/app/exam-builder";

export default function NewExamPage() {
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
        <Link href="/proctor/exams">
          <ArrowLeft /> Exams
        </Link>
      </Button>
      <PageHeader
        eyebrow="[ 02 ]  New exam"
        title={
          <>
            Create an exam. <b>Publish when ready.</b>
          </>
        }
        description="Exams start as drafts. Nobody can join until you publish."
      />
      <ExamBuilder />
    </>
  );
}
