import type { AppData, Course, Session } from './types'

export function getCourseById(data: AppData, courseId: string): Course | undefined {
  return data.courses.find((course) => course.id === courseId)
}

/** 取某门课程的全部时段 */
export function getSessionsOfCourse(data: AppData, courseId: string): Session[] {
  return data.sessions.filter((session) => session.courseId === courseId)
}
