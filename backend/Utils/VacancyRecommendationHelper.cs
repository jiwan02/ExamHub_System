using Examhub.Data;
using Examhub.Models;
using Examhub.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Examhub.Utils
{
    public static class VacancyRecommendationHelper
    {
        // Ranking for qualifications
        private static readonly Dictionary<string, int> QualificationRank = new()
        {
            { "SEE", 1 },
            { "+2", 2 },
            { "Bachelor", 3 },
            { "Master", 4 }
        };

        // ================== UTILITY METHODS ==================

        // Calculate user age from date of birth
        public static int CalculateAge(DateTime dateOfBirth)
        {
            var today = DateTime.Today;
            int age = today.Year - dateOfBirth.Year;
            if (dateOfBirth.Date > today.AddYears(-age)) age--; // Adjust if birthday not reached
            return age;
        }

        // Convert Vacancy into DTO (for API response)
        public static RecommendedVacancyDto CreateVacancyDto(Vacancy vacancy)
        {
            return new RecommendedVacancyDto
            {
                Id = vacancy.Id,
                Topic = vacancy.Topic,
                Qualifications = vacancy.Qualifications,
                AgeRange = vacancy.AgeRange,
                RequiredQualificationStream = vacancy.RequiredQualificationStream,
                ApplicationLink = vacancy.ApplicationLink,
                PostedDate = vacancy.PostedDate,
                ExamDate = vacancy.ExamDate,
                PostedBy = vacancy.PostedBy?.FullName,
                ImagePaths = vacancy.Images?.Select(img => img.ImagePath).ToList() ?? new List<string>()
            };
        }

        // ================== CONTENT-BASED FILTERING ==================

        // Check if user's qualification is equal or higher than vacancy requirement
        public static bool IsQualificationMatch(string userQualification, string vacancyQualification)
        {
            if (string.IsNullOrEmpty(vacancyQualification))
                return true; // No requirement means open for all

            if (!QualificationRank.TryGetValue(userQualification, out int userRank) ||
                !QualificationRank.TryGetValue(vacancyQualification, out int vacancyRank))
                return false;

            return userRank >= vacancyRank;
        }

        // Check if user's age fits vacancy's age requirement
        public static bool IsAgeInRange(int userAge, string ageRange)
        {
            if (string.IsNullOrEmpty(ageRange))
                return true; // No restriction

            try
            {
                var parts = ageRange.Split('-');
                if (parts.Length == 2 &&
                    int.TryParse(parts[0].Trim(), out int minAge) &&
                    int.TryParse(parts[1].Trim(), out int maxAge))
                {
                    return userAge >= minAge && userAge <= maxAge;
                }

                if (int.TryParse(ageRange.Trim(), out int exactAge))
                {
                    return userAge == exactAge;
                }
            }
            catch
            {
                return false;
            }

            return false;
        }

        // ================== MAIN METHOD (PURE CONTENT-BASED) ==================
        public static async Task<List<RecommendedVacancyDto>> GetContentBasedRecommendations(
            ApplicationDbContext context, int userId)
        {
            // Get user info
            var user = await context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null || !user.DateOfBirth.HasValue || string.IsNullOrEmpty(user.MinimumQualification))
                return new List<RecommendedVacancyDto>();

            // Calculate user attributes
            int userAge = CalculateAge(user.DateOfBirth.Value);
            string userQualification = user.MinimumQualification;
            string userStream = user.QualificationStream;

            // Get all vacancies
            var allVacancies = await context.Vacancies
                .Include(v => v.Images)
                .Include(v => v.PostedBy)
                .ToListAsync();

            // Filter vacancies based on user profile
            var recommendations = allVacancies
                .Where(v =>
                    IsQualificationMatch(userQualification, v.Qualifications) &&
                    IsAgeInRange(userAge, v.AgeRange) &&
                    (string.IsNullOrEmpty(v.RequiredQualificationStream) ||
                     v.RequiredQualificationStream.Equals("All", StringComparison.OrdinalIgnoreCase) ||
                     userStream == v.RequiredQualificationStream))
                .Select(CreateVacancyDto)
                .OrderByDescending(v => v.PostedDate)
                .Take(10)
                .ToList();

            return recommendations;
        }
    }
}
