import Link from "next/link";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";

type AdminFeatureRow = {
  menu: string;
  routeLabel: string;
  href: string;
  hrefLabel: string;
  interactions: string;
  notes: string;
};

const adminFeatureRows: AdminFeatureRow[] = [
  {
    menu: "회원 관리",
    routeLabel: "/admin/users",
    href: "/admin/users",
    hrefLabel: "열기",
    interactions:
      "회원 목록 조회, 가입 승인 ON/OFF, 승인/해제, 관리자 승격/해제, 비밀번호 초기화, 회원 상세 조회",
    notes: "관리자 승격은 승인된 회원에게만 가능",
  },
  {
    menu: "대회 목록",
    routeLabel: "/admin/tournaments",
    href: "/admin/tournaments",
    hrefLabel: "열기",
    interactions:
      "대회별 운영 메뉴 이동, 대회 삭제(soft delete), 공개 참가자 현황 페이지 이동",
    notes: "삭제 시 상태를 deleted로 변경",
  },
  {
    menu: "새 대회 생성",
    routeLabel: "/admin/tournaments/new",
    href: "/admin/tournaments/new",
    hrefLabel: "열기",
    interactions:
      "대회명, 일정, 코스, 장소, 티오프, 모집 기간, 상태, 메모 입력 후 생성",
    notes: "생성 완료 후 수정 페이지로 자동 이동",
  },
  {
    menu: "대회 수정",
    routeLabel: "/admin/tournaments/[id]/edit",
    href: "/admin/tournaments",
    hrefLabel: "대회 선택",
    interactions: "대회 정보 수정, 대회 복제, 대회 삭제(soft delete)",
    notes: "복제 시 동일 정보로 새 대회 생성",
  },
  {
    menu: "대회 현황",
    routeLabel: "/admin/tournaments/[id]/dashboard",
    href: "/admin/tournaments",
    hrefLabel: "대회 선택",
    interactions: "신청 상태 통계 확인, 전체 신청자 목록 조회",
    notes: "상세 상태 변경은 신청자 관리 메뉴에서 수행",
  },
  {
    menu: "신청자 관리",
    routeLabel: "/admin/tournaments/[id]/registrations",
    href: "/admin/tournaments",
    hrefLabel: "대회 선택",
    interactions:
      "상태별(신청/확정/대기/취소) 신청자 확인, 개별 상태 변경, 대리 신청자 확인, 식사/활동 통계 확인",
    notes: "회원/비회원(대리 등록) 구분 제공",
  },
  {
    menu: "조편성 관리",
    routeLabel: "/admin/tournaments/[id]/groups",
    href: "/admin/tournaments",
    hrefLabel: "대회 선택",
    interactions:
      "조 생성/삭제, 티오프 시간 수정, 멤버 배정, 조별 공개/비공개, 전체 공개/비공개",
    notes: "확정 참가자(approved) 중심으로 배정",
  },
  {
    menu: "라이브 조편성",
    routeLabel: "/admin/tournaments/[id]/draw",
    href: "/admin/tournaments",
    hrefLabel: "대회 선택",
    interactions:
      "세션 시작, 덱 셔플, 자동 픽, 배정 확정, 되돌리기, 멤버 이동, 전체 리셋",
    notes: "리셋 시 조편성 이벤트 기록과 배정 결과를 초기화",
  },
  {
    menu: "라운드 관리",
    routeLabel: "/admin/tournaments/[id]/side-events",
    href: "/admin/tournaments",
    hrefLabel: "대회 선택",
    interactions:
      "사전/사후 라운드 생성/수정/삭제, 라운드 상태 관리, 신청자 목록 확인, 식사/숙박 선택값 확인",
    notes: "대회별 라운드 관리자 권한으로도 접근 가능",
  },
  {
    menu: "라운드 관리자 권한",
    routeLabel: "/admin/tournaments/[id]/manager-setup",
    href: "/admin/tournaments",
    hrefLabel: "대회 선택",
    interactions: "이메일/닉네임 검색 후 라운드 관리자 권한 부여/회수",
    notes: "권한은 해당 대회에만 적용",
  },
  {
    menu: "활동/메뉴/파일",
    routeLabel:
      "/admin/tournaments/[id]/extras · /meal-options · /files",
    href: "/admin/tournaments",
    hrefLabel: "대회 선택",
    interactions:
      "추가 활동 관리(최대 3개), 식사 옵션 관리, 파일 업로드 및 공개 링크 제공",
    notes: "활동은 순서 변경과 soft delete 지원",
  },
];

const workflowSteps = [
  {
    title: "1. 대회 생성",
    description: "새 대회를 만들고 기본 정보를 입력합니다.",
    href: "/admin/tournaments/new",
    hrefLabel: "새 대회 만들기",
  },
  {
    title: "2. 상태 전환",
    description: "대회를 선택해 상태를 모집중(open)으로 변경합니다.",
    href: "/admin/tournaments",
    hrefLabel: "대회 선택/수정",
  },
  {
    title: "3. 회원 승인",
    description: "신규 회원 승인 및 관리자 권한을 관리합니다.",
    href: "/admin/users",
    hrefLabel: "회원 관리 열기",
  },
  {
    title: "4. 신청자 정리",
    description: "신청자를 확정/대기/취소 상태로 정리합니다.",
    href: "/admin/tournaments",
    hrefLabel: "대회 선택/신청자 관리",
  },
  {
    title: "5. 조편성 및 공개",
    description: "조편성 또는 라이브 추첨을 완료하고 공개 상태를 설정합니다.",
    href: "/admin/tournaments",
    hrefLabel: "대회 선택/조편성",
  },
];

export default function AdminHelpPage() {
  return (
    <main className="min-h-screen bg-[#F2F4F7] pb-24 text-slate-800">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-3 py-8 md:px-4 lg:px-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">관리자 기능 도움말</h1>
          <p className="text-sm text-slate-500">
            회원 관리, 대회 운영, 조편성, 라운드 관리 기능을
            실제 관리자 화면 기준으로 정리했습니다.
          </p>
        </header>

        <Card className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>운영 기본 흐름</CardTitle>
            <CardDescription>신규 대회 운영 시 권장 순서입니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            {workflowSteps.map((step) => (
              <div
                key={step.title}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-slate-900">{step.title}</p>
                  <p className="text-slate-600">{step.description}</p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={step.href}>{step.hrefLabel}</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>관리자 상호작용 목록</CardTitle>
            <CardDescription>메뉴별로 가능한 주요 동작입니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto lg:overflow-x-visible">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">메뉴</TableHead>
                    <TableHead className="whitespace-nowrap">경로</TableHead>
                    <TableHead>주요 상호작용</TableHead>
                    <TableHead>운영 메모</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminFeatureRows.map((row) => (
                    <TableRow key={`${row.menu}-${row.routeLabel}`}>
                      <TableCell className="whitespace-nowrap font-medium">{row.menu}</TableCell>
                      <TableCell className="space-y-2 whitespace-nowrap text-xs text-slate-600">
                        <code className="block">{row.routeLabel}</code>
                        <Button asChild size="sm" variant="outline" className="h-7">
                          <Link href={row.href}>{row.hrefLabel}</Link>
                        </Button>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">{row.interactions}</TableCell>
                      <TableCell className="text-sm text-slate-600">{row.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>상태값 가이드</CardTitle>
            <CardDescription>운영 중 자주 보는 상태값 기준입니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm text-slate-700">
              <p className="font-medium">대회 상태</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">draft: 작성중</Badge>
                <Badge variant="outline">open: 모집중</Badge>
                <Badge variant="outline">closed: 마감</Badge>
                <Badge variant="outline">done: 종료</Badge>
                <Badge variant="outline">deleted: 삭제(비공개)</Badge>
              </div>
            </div>
            <div className="space-y-2 text-sm text-slate-700">
              <p className="font-medium">참가 상태</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">applied: 신청</Badge>
                <Badge variant="secondary">approved: 확정</Badge>
                <Badge variant="secondary">waitlisted: 대기</Badge>
                <Badge variant="secondary">canceled: 취소</Badge>
                <Badge variant="secondary">undecided: 미정</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>웹서비스 기능 요약</CardTitle>
            <CardDescription>
              관리자가 문의 대응 시 참고할 수 있는 사용자 기능 요약입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p>
              1. 사용자 공통: 대회 목록 조회, 참가자 현황 확인, 공개 조편성/첨부파일 열람, 게시판 이용
            </p>
            <p>
              2. 로그인 회원: 본인/동반자 참가 신청, 참가 정보 수정/취소, 활동 선택, 라운드 신청,
              경품 지원, 내 신청 상태 확인
            </p>
            <p>
              3. 마이페이지: 닉네임/기본정보/비밀번호 관리, 카카오 계정 연동 지원
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-3">
          <Button asChild variant="secondary" className="h-auto flex-col">
            <Link href="/admin">
              <span className="text-lg">🏠</span>
              <span>관리자 홈</span>
            </Link>
          </Button>
          <Button asChild variant="secondary" className="h-auto flex-col">
            <Link href="/admin/tournaments">
              <span className="text-lg">📋</span>
              <span>대회 관리</span>
            </Link>
          </Button>
          <Button asChild variant="secondary" className="h-auto flex-col">
            <Link href="/admin/users">
              <span className="text-lg">👥</span>
              <span>회원 관리</span>
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
