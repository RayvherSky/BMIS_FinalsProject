import React, { useState } from 'react';
import { Button, Card, Form, Input, Select, Spin, Upload, Typography, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { createTicket } from '../api/ticketApi';
import { CATEGORIES } from '../utils/helpers';

const SubmitTicket = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [isCustomCategory, setIsCustomCategory] = useState(false); // Tracks if "Others" is selected

  const validatePhoto = (file) => {
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      message.error('Only JPEG, PNG, and WebP photos are allowed');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error('Photo must be 5 MB or smaller');
      return Upload.LIST_IGNORE;
    }
    return false;
  };

  const submit = async (values) => {
    setLoading(true);
    try {
      const data = new FormData();
      
      // Append all fields from the form directly (category + customCategory)
      for (const [key, value] of Object.entries(values)) {
        if (value) data.append(key, value);
      }
      
      if (fileList.length) data.append('image', fileList[0].originFileObj || fileList[0]);
      await createTicket(data);
      message.success('Incident reported successfully');
      navigate('/user/my-tickets');
    } catch (error) {
      message.error(error.response?.data?.message || 'Unable to submit your report');
    } finally {
      setLoading(false);
    }
  };

  const categoryOptions = CATEGORIES.map((value) => ({
    value,
    label: value === 'Others' ? 'Others (Please specify)' : value,
  }));

  return (
    <>
      <div className="user-page-intro"><span className="workspace-eyebrow">LET US KNOW</span><h1 className="page-title">Report an Incident</h1><p>Share the details and an optional photo. You can follow every public update in My Tickets.</p></div>
      <Card className="report-form-card" style={{ maxWidth: 860 }}>
        <Spin spinning={loading}>
          <Form layout="vertical" onFinish={submit} disabled={loading}>
            <Form.Item name="title" label="Title" rules={[{ required: true, whitespace: true, message: 'Please enter a title' }]}><Input placeholder="Briefly describe the issue" /></Form.Item>
            <Form.Item name="description" label="Description" rules={[{ required: true, whitespace: true, message: 'Please describe the incident' }]}><Input.TextArea rows={4} placeholder="Describe what happened and who is affected" /></Form.Item>
            
            <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Please select a category' }]}>
              <Select 
                aria-label="Category" 
                placeholder="Select a category" 
                options={categoryOptions} 
                virtual={false} 
                onChange={(value) => setIsCustomCategory(value === 'Others')}
              />
            </Form.Item>

            {/* Conditionally render the custom input if 'Others' is selected */}
            {isCustomCategory && (
              <Form.Item 
                name="customCategory" 
                label="Specify Category" 
                rules={[{ required: true, whitespace: true, message: 'Please specify your custom category' }]}
              >
                <Input placeholder="Enter custom category name" />
              </Form.Item>
            )}

            <Form.Item name="location" label="Location" rules={[{ required: true, whitespace: true, message: 'Please enter the location' }]}><Input placeholder="e.g., Quirino Ave. cor. Redemptorist Rd." /></Form.Item>
            <Typography.Paragraph type="secondary">New reports start at Medium priority. An administrator will assess the situation and update its priority.</Typography.Paragraph>
            <Form.Item label="Evidence Photo" extra="Optional. One JPEG, PNG, or WebP photo, up to 5 MB.">
              <Upload accept="image/jpeg,image/png,image/webp" listType="picture" maxCount={1} fileList={fileList} beforeUpload={validatePhoto} onChange={({ fileList: files }) => setFileList(files.slice(-1))}>
                <Button icon={<UploadOutlined />}>Choose Photo</Button>
              </Upload>
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>Submit Report</Button>
          </Form>
        </Spin>
      </Card>
    </>
  );
};

export default SubmitTicket;
