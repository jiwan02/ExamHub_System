import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { Edit, Upload, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';

const UpdateVacancy = () => {
  const [vacancies, setVacancies] = useState([]);
  const [selectedVacancy, setSelectedVacancy] = useState('');
  const [form, setForm] = useState({
    updateTopic: '',
    applicationLink: '',
  });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingVacancies, setLoadingVacancies] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchVacancies();
  }, []);

  const fetchVacancies = async () => {
    try {
      const { data } = await adminService.manageVacancies();
      setVacancies(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load vacancies');
    } finally {
      setLoadingVacancies(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVacancy) {
      setError('Please select a vacancy to update');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const updateData = {
        vacancyId: selectedVacancy,
        updateTopic: form.updateTopic,
        applicationLink: form.applicationLink,
        images: images.length > 0 ? images : undefined,
      };

      await adminService.postVacancyUpdate(updateData);
      setSuccess('Vacancy update posted successfully! Notifications sent to tracked users.');
      setForm({
        updateTopic: '',
        applicationLink: '',
      });
      setImages([]);
      setSelectedVacancy('');

      const fileInput = document.getElementById('images');
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post vacancy update');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e) => {
    if (e.target.files) {
      setImages(Array.from(e.target.files));
    }
  };

  const selectedVacancyDetails = vacancies.find(v => v.id === selectedVacancy);

  if (loadingVacancies) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="inline-flex items-center justify-center w-10 h-10 bg-amber-100 rounded-lg">
          <Edit className="h-6 w-6 text-amber-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Post Vacancy Update</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center">
          <CheckCircle className="h-5 w-5 mr-2" />
          {success}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="vacancy" className="block text-sm font-medium text-gray-700 mb-2">
              Select Vacancy to Update *
            </label>
            <select
              id="vacancy"
              required
              value={selectedVacancy}
              onChange={(e) => setSelectedVacancy(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Choose a vacancy...</option>
              {vacancies.map((vacancy) => (
                <option key={vacancy.id} value={vacancy.id}>
                  {vacancy.topic} - Posted on {new Date(vacancy.postedDate).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          {selectedVacancyDetails && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Selected Vacancy Details:</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p><strong>Topic:</strong> {selectedVacancyDetails.topic}</p>
                <p><strong>Qualifications:</strong> {selectedVacancyDetails.qualifications}</p>
                <p><strong>Age Range:</strong> {selectedVacancyDetails.ageRange}</p>
                <p><strong>Posted:</strong> {new Date(selectedVacancyDetails.postedDate).toLocaleDateString()}</p>
                {selectedVacancyDetails.examDate && (
                  <p><strong>Exam Date:</strong> {new Date(selectedVacancyDetails.examDate).toLocaleDateString()}</p>
                )}
                <div className="flex items-center mt-2">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  <a 
                    href={selectedVacancyDetails.applicationLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Current Application Link
                  </a>
                </div>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="updateTopic" className="block text-sm font-medium text-gray-700 mb-2">
              Update Topic/Title *
            </label>
            <input
              id="updateTopic"
              type="text"
              required
              value={form.updateTopic}
              onChange={(e) => setForm({ ...form, updateTopic: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter update title (e.g., 'Exam Date Extended', 'New Application Process')"
            />
          </div>

          <div>
            <label htmlFor="applicationLink" className="block text-sm font-medium text-gray-700 mb-2">
              <ExternalLink className="h-4 w-4 inline mr-1" />
              Updated Application Link *
            </label>
            <input
              id="applicationLink"
              type="url"
              required
              value={form.applicationLink}
              onChange={(e) => setForm({ ...form, applicationLink: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://example.com/updated-application-link"
            />
          </div>

          <div>
            <label htmlFor="images" className="block text-sm font-medium text-gray-700 mb-2">
              <Upload className="h-4 w-4 inline mr-1" />
              Upload Update Images (Optional)
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400 transition-colors">
              <div className="space-y-1 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="images"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                  >
                    <span>Upload update images</span>
                    <input
                      id="images"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageChange}
                      className="sr-only"
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB each</p>
                {images.length > 0 && (
                  <p className="text-sm text-green-600 font-medium">
                    {images.length} file(s) selected
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-amber-900 mb-2">Important Notes:</h3>
            <ul className="text-sm text-amber-800 space-y-1">
              <li>• This update will be sent to all users who are tracking this vacancy</li>
              <li>• Email notifications will be automatically sent to tracked users</li>
              <li>• The update will appear in the main vacancy feed</li>
              <li>• Make sure the application link is current and working</li>
            </ul>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 bg-amber-600 text-white px-8 py-3 rounded-lg hover:bg-amber-700 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Edit className="h-5 w-5" />
              <span>{loading ? 'Posting Update...' : 'Post Update'}</span>
            </button>
          </div>
        </form>
      </div>

      {vacancies.length === 0 && (
        <div className="text-center py-12">
          <Edit className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No vacancies available</h3>
          <p className="text-gray-600">Post your first vacancy before you can create updates.</p>
        </div>
      )}
    </div>
  );
};

export default UpdateVacancy;
