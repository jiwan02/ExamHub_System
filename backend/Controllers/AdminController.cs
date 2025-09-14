using Examhub.Data;
using Examhub.Models;
using Examhub.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace Examhub.Controllers
{
    [Route("api/admin")]
    [ApiController]
    [Authorize(Roles = "Admin")] 
    public class AdminController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public AdminController(ApplicationDbContext context)
        {
            _context = context;
        }

        // Categories
        [HttpPost("categories")]
        public async Task<IActionResult> CreateCategory([FromBody] CategoryDto dto)
        {
            var category = new Category { Name = dto.Name };
            _context.Categories.Add(category);
            await _context.SaveChangesAsync();
            return Ok(new CategoryDto { Id = category.Id, Name = category.Name });
        }

        [HttpDelete("categories/{id}")]
        public async Task<IActionResult> DeleteCategory(int id)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null) return NotFound("Category not found.");

            _context.Categories.Remove(category);
            await _context.SaveChangesAsync();
            return Ok();
        }

        // Topics
        [HttpPost("topics")]
        public async Task<IActionResult> CreateTopic([FromBody] TopicDto dto)
        {
            if (!await _context.Categories.AnyAsync(c => c.Id == dto.CategoryId))
                return BadRequest("Invalid CategoryId.");

            var topic = new Topic { Name = dto.Name, CategoryId = dto.CategoryId };
            _context.Topics.Add(topic);
            await _context.SaveChangesAsync();
            return Ok(new TopicDto { Id = topic.Id, Name = topic.Name, CategoryId = topic.CategoryId });
        }

        [HttpDelete("topics/{id}")]
        public async Task<IActionResult> DeleteTopic(int id)
        {
            var topic = await _context.Topics.FindAsync(id);
            if (topic == null) return NotFound("Topic not found.");

            _context.Topics.Remove(topic);
            await _context.SaveChangesAsync();
            return Ok();
        }

        // Study Materials (PDFs)
        [HttpPost("study-materials")]
        public async Task<IActionResult> UploadStudyMaterial([FromForm] string title, [FromForm] string? categoryId, [FromForm] string? topicId, IFormFile file)
        {
            if (file == null || !file.FileName.EndsWith(".pdf"))
                return BadRequest("Invalid file. Only PDFs are allowed.");

            // Check if both are null or empty
            if (string.IsNullOrEmpty(categoryId) && string.IsNullOrEmpty(topicId))
                return BadRequest("Either CategoryId or TopicId must be provided.");

            // Parse and validate categoryId
            int? categoryIdInt = null;
            if (!string.IsNullOrEmpty(categoryId))
            {
                if (!int.TryParse(categoryId, out int catId))
                    return BadRequest("Invalid CategoryId format.");

                if (!await _context.Categories.AnyAsync(c => c.Id == catId))
                    return BadRequest("Invalid CategoryId.");

                categoryIdInt = catId;
            }

            // Parse and validate topicId
            int? topicIdInt = null;
            if (!string.IsNullOrEmpty(topicId))
            {
                if (!int.TryParse(topicId, out int topId))
                    return BadRequest("Invalid TopicId format.");

                if (!await _context.Topics.AnyAsync(t => t.Id == topId))
                    return BadRequest("Invalid TopicId.");

                topicIdInt = topId;
            }

            var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/uploads");
            if (!Directory.Exists(uploadsDir))
                Directory.CreateDirectory(uploadsDir);

            var fileName = $"{Guid.NewGuid()}_{file.FileName}";
            var filePath = Path.Combine(uploadsDir, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var material = new StudyMaterial
            {
                Title = title,
                FilePath = $"/uploads/{fileName}",
                CategoryId = categoryIdInt,
                TopicId = topicIdInt,
                UploadedDate = DateTime.UtcNow,
                UploadedById = int.Parse(User.FindFirst("UserId")?.Value ?? "0")
            };

            _context.StudyMaterials.Add(material);
            await _context.SaveChangesAsync();

            return Ok(new StudyMaterialDto
            {
                Id = material.Id,
                Title = material.Title,
                FilePath = material.FilePath,
                CategoryId = material.CategoryId,
                CategoryName = material.Category?.Name,
                TopicId = material.TopicId,
                TopicName = material.Topic?.Name,
                UploadedDate = material.UploadedDate,
                UploadedBy = material.UploadedBy?.FullName
            });
        }

        [HttpDelete("study-materials/{id}")]
        public async Task<IActionResult> DeleteStudyMaterial(int id)
        {
            var material = await _context.StudyMaterials.FindAsync(id);
            if (material == null) return NotFound("Study material not found.");

            var fullPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", material.FilePath.TrimStart('/'));
            if (System.IO.File.Exists(fullPath))
                System.IO.File.Delete(fullPath);

            _context.StudyMaterials.Remove(material);
            await _context.SaveChangesAsync();
            return Ok();
        }
        // Add these methods to your AdminController class

        [HttpGet("categories")]
        public async Task<IActionResult> GetCategories()
        {
            var categories = await _context.Categories
                .Select(c => new CategoryDto { Id = c.Id, Name = c.Name })
                .ToListAsync();
            return Ok(categories);
        }

        [HttpGet("categories/{categoryId}/topics")]
        public async Task<IActionResult> GetTopics(int categoryId)
        {
            if (!await _context.Categories.AnyAsync(c => c.Id == categoryId))
                return NotFound("Category not found.");

            var topics = await _context.Topics
                .Where(t => t.CategoryId == categoryId)
                .Select(t => new TopicDto { Id = t.Id, Name = t.Name, CategoryId = t.CategoryId })
                .ToListAsync();
            return Ok(topics);
        }

    }
}