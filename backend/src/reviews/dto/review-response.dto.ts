export class ReviewResponseDto {
  reviewId: number;
  status: string;
  reviewerRole: string;

  cycle: {
    id: number;
    name: string;
    status: string;
  };

  employee: {
    id: number;
    name: string;
    email: string;
  };

  reviewer: {
    id: number;
    name: string;
    email: string;
  };

  sections: {
    sectionId: number;
    sectionName: string;
    points: {
      pointId: number;
      title: string;
      responses: {
        responseId: number;
        rating: number;
        comment: string;
      }[];
    }[];
  }[];
}