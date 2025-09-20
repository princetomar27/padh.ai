"use client";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { useTRPC } from "@/trpc/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  BookOpen,
  FileText,
  Plus,
  Filter,
  PencilIcon,
} from "lucide-react";
import { NewClassDialog } from "../components/new-class-dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import RemoveClassDialog from "../components/remove-class-dialog";

const AdminClassesView = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery(
    trpc.classes.getMany.queryOptions({
      page: 1,
      pageSize: 50, // Get more classes
      search: "",
      classNumber: null,
      isActive: null,
    })
  );

  const classes = data?.items || [];
  const [loadingClassId, setLoadingClassId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editingClass, setEditingClass] = useState<any>(null);

  const toggleClass = useMutation(
    trpc.classes.toggleClassStatus.mutationOptions({
      onSuccess: (updatedClass) => {
        console.log("Class status toggled", updatedClass);

        // Update the specific class in the cache optimistically
        queryClient.setQueryData(
          trpc.classes.getMany.queryOptions({
            page: 1,
            pageSize: 50,
            search: "",
            classNumber: null,
            isActive: null,
          }).queryKey,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (oldData: any) => {
            if (!oldData) return oldData;

            return {
              ...oldData,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              items: oldData.items.map((classItem: any) =>
                classItem.id === updatedClass.id ? updatedClass : classItem
              ),
            };
          }
        );

        setLoadingClassId(null);
      },
      onError: (error) => {
        toast.error(error.message);
        setLoadingClassId(null);
      },
    })
  );

  const handleClassCreated = () => {
    console.log("Class created");
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditClass = (classItem: any) => {
    setEditingClass(classItem);
  };

  const handleEditSuccess = () => {
    setEditingClass(null);
  };

  return (
    <div className="min-h-screen bg-background  space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between sm:flex-row flex-col gap-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Class Management
          </h1>
          <p className="text-muted-foreground">
            Manage educational classes and their configurations
          </p>
        </div>
        <NewClassDialog onSuccess={handleClassCreated}>
          <Button className="bg-purple-600 hover:bg-purple-700">
            <Plus className="mr-2 h-4 w-4" />
            Add New Class
          </Button>
        </NewClassDialog>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Input placeholder="Search classes..." className="pl-4" />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </div>

      {/* Classes Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 py-4">
        {classes.map((classItem) => (
          <Card
            key={classItem.id}
            className="group hover:shadow-lg transition-all duration-200 border-2 hover:border-purple-200 relative overflow-hidden"
          >
            {/* Class Number Badge */}
            <div className="absolute top-4 right-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditClass(classItem)}
                >
                  <PencilIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="text-white"
                >
                  <RemoveClassDialog
                    classId={classItem.id}
                    className={classItem.name}
                    classNumber={classItem.number}
                    studentCount={classItem.studentCount}
                    onLoadingChange={(loading) =>
                      setLoadingClassId(loading ? classItem.id : null)
                    }
                  />
                </Button>
              </div>
            </div>

            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-xl font-bold group-hover:text-purple-700 transition-colors">
                    Class {classItem.number}
                  </CardTitle>
                  <Badge
                    variant={classItem.isActive ? "default" : "secondary"}
                    className={
                      classItem.isActive
                        ? "bg-green-100 text-green-800 hover:bg-green-100"
                        : "bg-gray-100 text-gray-600"
                    }
                  >
                    {classItem.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {classItem.description}
              </p>
            </CardHeader>

            <CardContent className="space-y-4">
              {loadingClassId === classItem.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent"></div>
                </div>
              )}
              {/* Statistics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      {classItem.studentCount || 0}
                    </p>
                    <p className="text-xs text-blue-600">Students</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                  <div className="p-2 bg-green-100 rounded-full">
                    <BookOpen className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-900">
                      {classItem.subjectCount || 0}
                    </p>
                    <p className="text-xs text-green-600">Subjects</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" size="sm" className="flex-1 mr-2">
                  <FileText className="mr-2 h-3 w-3" />
                  Subjects
                </Button>
                <Button variant="outline" size="sm" className="flex-1 ml-2">
                  <BookOpen className="mr-2 h-3 w-3" />
                  View Books →
                </Button>
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="text-sm font-medium">Class Status</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={classItem.isActive}
                    disabled={loadingClassId === classItem.id}
                    className="sr-only peer"
                    onChange={() => {
                      setLoadingClassId(classItem.id);
                      console.log(`Toggle class ${classItem.id}`);
                      toggleClass.mutate({ id: classItem.id });
                    }}
                  />
                  <div
                    className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 ${
                      loadingClassId === classItem.id ? "opacity-50" : ""
                    }`}
                  ></div>
                </label>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {classes.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
            <BookOpen className="h-24 w-24" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No classes found
          </h3>
          <p className="text-gray-500 mb-6">
            Get started by creating your first class
          </p>
          <NewClassDialog onSuccess={handleClassCreated}>
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="mr-2 h-4 w-4" />
              Create First Class
            </Button>
          </NewClassDialog>
        </div>
      )}

      {/* Edit Class Dialog */}
      {editingClass && (
        <NewClassDialog
          key={editingClass.id}
          initialValues={editingClass}
          onSuccess={handleEditSuccess}
        >
          <div />
        </NewClassDialog>
      )}
    </div>
  );
};

export default AdminClassesView;

export function AdminClassViewLoading() {
  return (
    <LoadingState
      title="Loading Classes"
      description="Please wait while we load the classes"
    />
  );
}

export function AdminClassViewError() {
  return (
    <ErrorState
      title="Error Loading Classes"
      description="Please try again later"
    />
  );
}
