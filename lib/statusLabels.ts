export const formatTournamentStatus = (status: string) => {
  switch (status) {
    case "draft":
      return "작성중";
    case "open":
      return "모집중";
    case "closed":
      return "마감";
    case "done":
      return "종료";
    default:
      return status;
  }
};

export const formatRegistrationStatus = (status: string) => {
  switch (status) {
    case "undecided":
      return "미정";
    case "applied":
      return "신청";
    case "approved":
    case "confirmed":
      return "확정";
    case "waitlisted":
      return "대기";
    case "canceled":
      return "취소";
    default:
      return status;
  }
};
