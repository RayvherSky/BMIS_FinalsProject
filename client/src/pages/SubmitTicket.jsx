import React, { useState } from 'react';
import { Button, Card, Form, Input, Select, Spin, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout/AppLayout';
import { createTicket } from '../api/ticketApi';
import { CATEGORIES, PRIORITIES } from '../utils/helpers';

const SubmitTicket = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState([]);

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
      for (const [key, value] of Object.entries(values)) data.append(key, value);
      if (fileList.length) data.append('image', fileList[0].originFileObj || fileList[0]);
      await createTicket(data);
      message.success('Incident reported successfully');
      navigate('/resident/my-tickets');
    } catch (error) {
      message.error(error.response?.data?.message || 'Unable to submit your report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <h1 className="page-title">Report an Incident</h1>
      <Card style={{ maxWidth: 860 }}>
        <Spin spinning={loading}>
          <Form layout="vertical" onFinish={submit} initialValues={{ priority: 'Medium' }} disabled={loading}>
            <Form.Item name="title" label="Title" rules={[{ required: true, whitespace: true, message: 'Please enter a title' }]}><Input placeholder="Briefly describe the issue" /></Form.Item>
            <Form.Item name="description" label="Description" rules={[{ required: true, whitespace: true, message: 'Please describe the incident' }]}><Input.TextArea rows={4} placeholder="Describe what happened and how residents are affected" /></Form.Item>
            <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Please select a category' }]}><Select aria-label="Category" placeholder="Select a category" options={CATEGORIES.map((value) => ({ value, label: value }))} virtual={false} /></Form.Item>
            <Form.Item name="location" label="Location" rules={[{ required: true, whitespace: true, message: 'Please enter the location' }]}><Input placeholder="e.g., Quirino Ave. cor. Redemptorist Rd." /></Form.Item>
            <Form.Item name="priority" label="Priority" rules={[{ required: true }]}><Select aria-label="Priority" options={PRIORITIES.map((value) => ({ value, label: value }))} /></Form.Item>
            <Form.Item label="Evidence Photo" extra="Optional. One JPEG, PNG, or WebP photo, up to 5 MB.">
              <Upload accept="image/jpeg,image/png,image/webp" listType="picture" maxCount={1} fileList={fileList} beforeUpload={validatePhoto} onChange={({ fileList: files }) => setFileList(files.slice(-1))}>
                <Button icon={<UploadOutlined />}>Choose Photo</Button>
              </Upload>
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>Submit Report</Button>
          </Form>
        </Spin>
      </Card>
    </AppLayout>
  );
};

export default SubmitTicket;
