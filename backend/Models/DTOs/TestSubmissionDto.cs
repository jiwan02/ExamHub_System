namespace Examhub.Models.DTOs
{
    public class TestSubmissionDto
    {
        public int StudyMaterialId { get; set; }
        public int[] answers { get; set; } // Must match frontend's "answers" (lowercase)
    }
}